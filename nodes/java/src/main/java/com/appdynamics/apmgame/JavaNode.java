package com.appdynamics.apmgame;

import net.sf.ehcache.Element;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletHandler;

import javax.json.*;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.StringReader;
import java.net.URL;
import java.util.Scanner;
import java.util.concurrent.ThreadLocalRandom;

/*import org.ehcache.Cache;
import org.ehcache.CacheManager;
import org.ehcache.config.builders.CacheManagerBuilder;
import org.ehcache.config.builders.CacheConfigurationBuilder;
import org.ehcache.config.builders.ResourcePoolsBuilder;*/

import net.sf.ehcache.Cache;
import net.sf.ehcache.CacheManager;

public class JavaNode {

    protected static Cache cache;

    public static void main(String[] args) throws Exception {

        int port = 8080;
        CacheManager cacheManager;

        if (args.length > 0) {
            port = Integer.parseInt(args[0]);
        }

        JsonReader jsonReader = Json.createReader(new StringReader(System.getenv("APP_CONFIG")));
        JsonObject config = jsonReader.readObject();

        jsonReader = Json.createReader(new StringReader(System.getenv("APM_CONFIG")));
        JsonObject apmConfig = jsonReader.readObject();

        CacheManager cm = CacheManager.getInstance();

        cm.addCache("cache1");

        cache = cm.getCache("cache1");

        Server server = new Server(port);
        ServletHandler handler = new ServletHandler();
        server.setHandler(handler);

        NodeServlet.setConfig(config, apmConfig);

        handler.addServletWithMapping(NodeServlet.class, "/*");

        server.start();
        server.join();
    }

    @SuppressWarnings("serial")
    public static class NodeServlet extends HttpServlet {
        protected static JsonObject config;
        protected static JsonObject apmConfig;
        protected static JsonObject endpoints;


        public static void setConfig(JsonObject config, JsonObject apmConfig) {
            NodeServlet.config = config;
            NodeServlet.apmConfig = apmConfig;
            NodeServlet.endpoints = config.getJsonObject("endpoints").getJsonObject("http");
        }

        protected String buildResponse(int timeout) {
            long start = System.currentTimeMillis();
            long finish = start;
            String response = "";
            while(finish - start < timeout) {
                response += " ";
                finish = System.currentTimeMillis();
            }
            return response.length() + "slow response";
        }

        protected String loadFromCache(int timeout) {
            long start = System.currentTimeMillis();
            long finish = start;
            int i = 0;
            Integer element = new Integer(0);
            while(finish - start < timeout) {
                i++;
                element = new Integer(i);
                cache.putIfAbsent(new Element(element, i));
                finish = System.currentTimeMillis();
            }
            return "Cache result: " + cache.get(element).toString();
        }

        protected String processCall(String call) throws HttpException {
            if (call.startsWith("sleep")) {
                int timeout = Integer.parseInt(call.split(",")[1]);
                try {
                    Thread.sleep(timeout);
                } catch (InterruptedException e) {

                }
                return "Slept for " + timeout;
            }

            if (call.startsWith("slow")) {
                int timeout = Integer.parseInt(call.split(",")[1]);
                return this.buildResponse(timeout);
            }

            if (call.startsWith("cache")) {
                int timeout = Integer.parseInt(call.split(",")[1]);
                return this.loadFromCache(timeout);
            }

            if (call.startsWith("http://")) {
                try {
                    URL url = new URL(call);
                    return new Scanner( url.openStream() ).useDelimiter( "\\Z" ).next();
                } catch (Exception e) {
                    return e.getMessage();
                }
            }

            if (call.startsWith("error")) {
                throw new HttpException(500, "error");
            }
            return ":" + call + " is not supported";
        }

        protected String preProcessCall(JsonValue call) throws HttpException {
            if (call.getValueType() == JsonValue.ValueType.ARRAY) {
                JsonArray arr = (JsonArray) call;
                int index = ThreadLocalRandom.current().nextInt(arr.size());
                call = arr.get(index);
            }
            if (call.getValueType() == JsonValue.ValueType.OBJECT) {
                JsonObject obj = (JsonObject) call;
                double probability = obj.getJsonNumber("probability").doubleValue();
                call = obj.getJsonString("call");
                if (probability * 100 < ThreadLocalRandom.current().nextInt(100)) {
                    return call + " was not probable";
                }
            }
            return this.processCall(((JsonString) call).getString());
        }

        public void handleEndpoint(HttpServletResponse response, JsonArray endpoint) throws IOException {
            response.setStatus(HttpServletResponse.SC_OK);

            StringBuilder result = new StringBuilder();

            for (JsonValue entry : endpoint) {
                result.append(this.preProcessCall(entry));
            }

            if(NodeServlet.apmConfig.containsKey("eum")) {
                response.getWriter().println("<!doctype html><html lang=\"en\"><head><title>" + NodeServlet.config.getString("name") + "</title><script>window['adrum-start-time'] = new Date().getTime();window['adrum-config'] = " + NodeServlet.apmConfig.getJsonObject("eum") + " </script><script src='//cdn.appdynamics.com/adrum/adrum-latest.js'></script><body>" + result);
            } else {
                response.getWriter().println(result);
            }
        }

        @Override
        protected void doGet(HttpServletRequest request,
                             HttpServletResponse response) throws ServletException,
                IOException {
            String endpoint = request.getRequestURI().toString();

            response.setContentType("text/html;charset=utf-8");

            try {
                if (NodeServlet.endpoints.containsKey(endpoint)) {
                    this.handleEndpoint(response, NodeServlet.endpoints.getJsonArray(endpoint));
                } else if (NodeServlet.endpoints.containsKey(endpoint.substring(1))) {
                    this.handleEndpoint(response, NodeServlet.endpoints.getJsonArray(endpoint.substring(1)));
                } else {
                    response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    response.getWriter().println(404);
                }
            } catch (HttpException e) {
                response.setStatus(e.getCode());
                response.getWriter().println(e.getMessage());
            }
        }
    }
}

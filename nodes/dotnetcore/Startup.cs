using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Net.Http;
using Microsoft.AspNetCore.Mvc;

namespace dotnetcore
{
    namespace Controllers 
    {
        public class HomeController : Controller
        {
            private async Task<string> processCall(JToken token)
            {
                string call = "";
                if (token is JObject)
                {
                    call = token["call"].ToString();
                    Random rnd = new Random();
                    if (token["probability"] != null && Double.Parse(token["probability"].ToString()) <= rnd.NextDouble())
                    {   
                        return call + " was not probable";
                    }
                }
                if (token is JValue)
                {
                    call = token.ToString();
                }

                // Walk over all potential commands
                if (call.StartsWith("sleep"))
                {
                    string[] r = call.Split(",");
                    Thread.Sleep(Int32.Parse(r[1]));
                    return call;
                }
                else if (call.StartsWith("http://"))
                {
                    HttpClient c = new HttpClient();
                    c.BaseAddress = new Uri(call);
                    c.DefaultRequestHeaders.Add("User-Agent", "apmgame/2.0.0");
                    return await c.GetStringAsync("");
                }
                else if (call.StartsWith("slow"))
                {
                    string[] r = call.Split(",");
                    Stopwatch stopWatch = new Stopwatch();
                    stopWatch.Start();
                    string response = "";
                    while (stopWatch.ElapsedMilliseconds < Int64.Parse(r[1]))
                    {
                        response += " ";
                    }
                    return response.Length + " slow response";
                } 
                else if (call.StartsWith("error")) 
                {
                    string[] r = call.Split(",");
                    throw new WebException(r.Length > 2 ? r[2] : "", Int32.Parse(r[1]));
                }
                
                return call + " is not supported";
            }

            public async Task<IActionResult> Index()
            {
                JToken value = (JToken)RouteData.DataTokens["Value"];

                int code = 200;

                if(value is JArray)
                {
                    JArray calls = (JArray)value;
                    List<string> result = new List<String>();
                    foreach (JToken token in calls)
                    {
                        try {                                    
                            result.Add(await processCall(token));
                        } catch (WebException e) {
                            code = e.Code;
                            result.Add(e.Message);
                        }
                    }
                    string finalResponse = JsonConvert.SerializeObject(result);
                    //await context.Response.WriteAsync(finalResponse);
                    //context.Response.Headers.ContentLength = finalResponse.Length;
                    return StatusCode(code, finalResponse);
                }
                return Ok("200");
            }
        }
    }

    public class Startup
    {
        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllers();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.UseMiddleware<RequestLoggingMiddleware>();

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            string appConfig = Environment.GetEnvironmentVariable("APP_CONFIG");

            if (String.IsNullOrEmpty(appConfig))
            {
                appConfig = "{ endpoints: {}}";
            }
            
            Console.WriteLine(appConfig);

            JObject config = JsonConvert.DeserializeObject<JObject>(appConfig);

            app.UseRouting();

            app.UseEndpoints(appEndpoints =>
            {
                if (config["endpoints"] is JObject && config["endpoints"]["http"] is JObject)
                {
                    foreach (KeyValuePair<string, JToken> endpoint in (JObject)config["endpoints"]["http"])
                    {
                        appEndpoints.MapControllerRoute(
                            name: "Default", 
                            pattern: endpoint.Key,
                            defaults: new { controller = "Home", action = "Index"},
                            dataTokens: new { Value = endpoint.Value }
                        );
                    }
                }
            });
        }
    }
}

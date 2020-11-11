using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace dotnetcore
{
    public class RequestLoggingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger _logger;

        public RequestLoggingMiddleware(RequestDelegate next, ILoggerFactory loggerFactory)
        {
            _next = next;
            _logger = loggerFactory.CreateLogger<RequestLoggingMiddleware>();
        }

        public async Task Invoke(HttpContext context)
        {
            var watch = Stopwatch.StartNew();
            try
            {
                await _next(context);
            }
            finally
            {
                watch.Stop();
                string logLevelString = "INFO";
                LogLevel ll = LogLevel.Information;

                if(context.Response?.StatusCode > 399) {
                    logLevelString = "ERROR";
                    ll = LogLevel.Error;
                }

                Console.WriteLine(context.Request?.Headers);

                _logger.Log(ll,
                    "{dateTime}  [{processId}] [] {level} default - {remoteAddr} - \"{method} {url}\" {statusCode} {length} \"{userAgent}\" - {time} ms",
                    DateTime.Now.ToString("yyyyy-MM-dd HH:mm:ss,fff"),
                    Process.GetCurrentProcess().Id,
                    logLevelString,
                    context.Connection.RemoteIpAddress,
                    context.Request?.Method,
                    context.Request?.Path.Value,
                    context.Response?.StatusCode,
                    context.Response?.ContentLength,
                    context.Request?.Headers["User-Agent"].ToString(),
                    watch.ElapsedMilliseconds);
            }
        }
    }
}
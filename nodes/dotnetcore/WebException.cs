using System;

namespace dotnetcore
{
    public class WebException : Exception
    {
        public int Code { get; }
        public WebException(string message, int code) : base(message) {
            Code = code;
        }
    }
}
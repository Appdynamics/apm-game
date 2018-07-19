package com.appdynamics.apmgame;

import java.io.IOException;

public class HttpException extends IOException
{
  protected int code;

  public HttpException(int code, String message) {
    super(message);
    this.code = code;
  }

  public int getCode() {
    return this.code;
  }
}

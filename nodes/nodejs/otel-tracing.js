'use strict'
const { LogLevel } = require('@opentelemetry/core')
const { NodeTracerProvider } = require('@opentelemetry/node')
const { BatchSpanProcessor } = require('@opentelemetry/tracing')
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin')

const config = JSON.parse(process.env.APP_CONFIG)

const provider = new NodeTracerProvider({
  logLevel: LogLevel.DEBUG
})

provider.register()

const exporter = new ZipkinExporter({
  serviceName: config.name,
  url: 'http://opentelemetry-collector:9411/'
  // If you are running your tracing backend on another host,
  // you can point to it using the `url` parameter of the
  // exporter config.
})
provider.addSpanProcessor(new BatchSpanProcessor(exporter, {
  // send spans as soon as we have this many
  bufferSize: 2,
  // send spans if we have buffered spans older than this
  bufferTimeout: 50
}))

console.log('tracing initialized')

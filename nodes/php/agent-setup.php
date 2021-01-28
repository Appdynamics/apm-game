<?php
$config = json_decode($_ENV["APM_CONFIG"]);
$service = json_decode($_ENV["APP_CONFIG"]);

$file = file_get_contents($argv[1]);

$controller = parse_url($config->controller);

$keys = [
  'CONTROLLERHOST' => $controller['host'],
  'CONTROLLERPORT' => $controller['port'],
  'APPLICATIONNAME' => $config->applicationName,
  'TIERNAME' => $service->name,
  'NODENAME' => $service->name.'-'.gethostname(),
  'NODEREUSEPREFIX' => $service->name,
  'ACCOUNTNAME' => $config->accountName,
  'ACCESSKEY' => $config->accountAccessKey
];

foreach($keys as $key => $value) {
  $file = str_replace($key, $value, $file);
}

$sslEnabled = $controller['scheme'] === 'https';

if($sslEnabled) {
  $file = str_replace('agent.controller.ssl.enabled = 0', 'agent.controller.ssl.enabled = 1', $file);
} else {
  $file = str_replace('agent.controller.ssl.enabled = 1', 'agent.controller.ssl.enabled = 0', $file);
}

file_put_contents($argv[1], $file);

<?php

function startsWith($haystack, $needle)
{
     $length = strlen($needle);
     return (substr($haystack, 0, $length) === $needle);
}

function buildResponse($timeout) {
  $start = microtime(true);
  $finish = $start;
  $response = "";
  while($finish - $start < $timeout/1000) {
    $response .= " ";
    $finish = microtime(true);
  }
  return strlen($response) . " slow response";
}

function processCall($call) {
  if(is_array($call)) {
    shuffle($call);
    $call = $call[0];
  }
  if(is_object($call)) {
    if($call->probability * 100 <= rand(0, 100)) {
      return $call->call." was not probable";
    }
    $call = $call->call;
  }
  if(startsWith($call, 'sleep')) {
      $timeout = explode(',', $call)[1];
      usleep($timeout * 1000);
      return "Slept for ${timeout}";
  } elseif(startsWith($call, 'slow')) {
      $timeout = explode(',', $call)[1];
      return buildResponse($timeout);
  } elseif(startsWith($call, 'error')) {
      $error = explode(',', $call);
      throw new Exception($error[2], $error[1]);
  } elseif(startsWith($call, 'http')) {
      $ch = curl_init();
      curl_setopt($ch, CURLOPT_URL, $call);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      return curl_exec($ch);
  }
  return "${call} is not supported";
}

$parsed_url = parse_url($_SERVER['REQUEST_URI']);
$config = json_decode($_ENV['APP_CONFIG']);

$endpoint = $parsed_url['path'];
$endpoints = $config->endpoints->http;

foreach ($endpoints as $key => $value) {
    if(!startsWith($key, '/')) {
      $newKey = '/' . $key;
      $endpoints->$newKey = $value;
    }
}

if(property_exists($endpoints, $endpoint)) {
  try {
    $result = array_map(processCall, $endpoints->$endpoint);
    echo json_encode($result);
  } catch(Exception $e) {
    http_response_code($e->getCode());
    echo $e->getMessage();
  }
} else {
  http_response_code(404);
  echo 404;
}

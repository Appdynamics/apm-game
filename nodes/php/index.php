<?php

if(!extension_loaded('appdynamics_agent')) {
    function appdynamics_start_transaction($arg1, $arg2) {}
    function appdynamics_continue_transaction($arg1) {}
    function appdynamics_end_transaction() {}
    function appdynamics_begin_exit_call() {}
    function appdynamics_end_exit_call() {}
}

$apmConfig = json_decode($_ENV["APM_CONFIG"]);

$withEum = false;

if(isset($apmConfig->eum)) {
  $withEum = true;
  $eumConfig = $apmConfig->eum;

  $eumConfig->xd = ["enable" => false];
}

function startsWith($haystack, $needle)
{
     $length = strlen($needle);
     return (substr($haystack, 0, $length) === $needle);
}

function loadFromCache($timeout) {
  $start = microtime(true);
  $finish = $start;
  $response = "";
  while($finish - $start < $timeout/1000) {
    $exitCall = appdynamics_begin_exit_call(AD_EXIT_CACHE, 'Redis Cache', ['VENDOR' => 'Redis', "SERVER POOL" => 'redis:6380'], false);
    usleep(1000 * rand(100,200));
    if(!is_null($exitCall)) {
      appdynamics_end_exit_call($exitCall);
    }
    $finish = microtime(true);
  }
  return  ($finish - $start). " loaded from cache";
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

function queryDatabase($url) {

  $hostName = $url['host'];
  $database = substr($url['path'], 1);

  parse_str($url['query'], $query);
  $query = $query['query'];

  try {
      $dbh = new PDO('mysql:dbname='.$database.';host='.$hostName, 'root', 'root');
  } catch (PDOException $e) {
      return 'Connection failed: ' . $e->getMessage();
  }

  $dbh->query($query);

  return "Database query '".$query."' executed on ".$database."@".$hostName;
}

function processCall($call) {

  $remoteTimeout = false;
  $catchExceptions = true;

  if(is_array($call)) {
    shuffle($call);
    $call = $call[0];
  }
  if(is_object($call)) {
    if(isset($call->probability) && $call->probability * 100 <= rand(0, 100)) {
      return $call->call." was not probable";
    }
    if(isset($call->remoteTimeout)) {
      $remoteTimeout = $call->remoteTimeout;
    }
    if(isset($call->catchExceptions)) {
      $catchExceptions = $call->catchExceptions;
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
  } elseif(startsWith($call, 'image')) {
      $src = explode(',', $call)[1];
      return "<img src=".$src.">";
  } elseif(startsWith($call, 'http')) {
      $ch = curl_init();
      curl_setopt($ch, CURLOPT_URL, $call);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      if(is_numeric($remoteTimeout)) {
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, $remoteTimeout);
      }
      curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
      $r = curl_exec($ch);
      if(curl_errno($ch)) {
        if(!$catchExceptions) {
          throw new Exception(curl_error($ch), 500);
        }
        return curl_error($ch);
      }
      return $r;
  } elseif(startsWith($call, 'cache')) {
    $timeout = explode(',', $call)[1];
    return loadFromCache($timeout);
  } elseif(startsWith($call, 'sql')) {
    return queryDatabase(parse_url($call));
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

    if($_SERVER['CONTENT_TYPE'] && $_SERVER['CONTENT_TYPE'] === 'application/json') {
      $withEum = false;
    }

    if($withEum) {
      echo "<!doctype html><html lang=\"en\"><head><title>" . $name . "</title><script>window['adrum-start-time'] = new Date().getTime();window['adrum-config'] = ". json_encode($eumConfig) ."}</script><script src='//cdn.appdynamics.com/adrum/adrum-latest.js'></script><body>".json_encode($result);
    } else {
      echo json_encode($result);
    }
  } catch(Exception $e) {
    http_response_code($e->getCode());
    echo $e->getMessage();
  }
} else {
  http_response_code(404);
  echo 404;
}

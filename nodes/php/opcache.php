<?php
class OpcacheHelper {

  private $status;

  function __construct() {
    $this->status = opcache_get_status();
  }
  function run() {
    return $this;
  }

  function __get($value) {
    if(array_key_exists($value, $this->status)) {
      $result = $this->status[$value];
      if(is_array($result)) {
        return (object)$result;
      }
      return $result;
    }
    return 'not found';
  }

  function get($value, $d = '.') {
    $v = explode($d, $value);
    $a = $this->status;
    foreach($v as $e) {
	$a = $a[$e];
    }
    return $a;
  }

  function __toString() {
    return json_encode($this->status);
  }
}

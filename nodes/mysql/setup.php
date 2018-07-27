<?php
echo "Setup ...".PHP_EOL;

$config = json_decode($_SERVER['APP_CONFIG']);

$result = "";

foreach($config->databases as $database => $tables) {
  $result .= "CREATE DATABASE ".$database.";".PHP_EOL;
  $result .= "USE ".$database.";".PHP_EOL;
  foreach($tables as $table => $columns) {
    $result .="CREATE TABLE ".$table." (".PHP_EOL;
    foreach($columns as $column) {
      if($column === 'id') {
        $result .= "  ".$column." INT(6) UNSIGNED AUTO_INCREMENT PRIMARY KEY,".PHP_EOL;
      } else {
        $result .= "  ".$column. " VARCHAR(255),".PHP_EOL;
      }
    }

    $result = substr($result,0,-2).PHP_EOL;

    $result .=') ENGINE=InnoDB;'.PHP_EOL;
  }
}

echo '=====.PHP_EOL';

echo $result;

echo '=====.PHP_EOL';

file_put_contents("/tmp/create.sql",$result);

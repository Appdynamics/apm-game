#!/bin/bash
# APP_CONFIG={"type":"mysql","databases":{"shop":{"carts":["id","name","value"],"customers":["id","name","email"]}},"name":"backend-db"}
php /tmp/setup.php
mysql -uroot -p${MYSQL_ROOT_PASSWORD} < /tmp/create.sql

#!/bin/sh
# One-shot provisioning: creates the "Application logs" data view in Kibana
# (filebeat-*) and makes it the default, so logs are browsable in
# Discover without a single manual click.
set -u

echo 'Waiting for Kibana...'
until [ "$(curl -s -o /dev/null -w '%{http_code}' http://kibana:5601/api/status)" = '200' ]; do
  sleep 5
done

echo 'Creating the filebeat-* data view...'
curl -s -X POST http://kibana:5601/api/data_views/data_view \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"data_view":{"id":"app-logs","title":"filebeat-*","name":"Application logs","timeFieldName":"@timestamp","allowNoIndex":true},"override":false}' \
  >/dev/null

curl -s -X POST http://kibana:5601/api/data_views/default \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"data_view_id":"app-logs","force":true}' \
  >/dev/null

echo 'Kibana data view provisioned.'

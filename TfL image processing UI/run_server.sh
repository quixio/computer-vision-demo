#!/bin/sh
echo "${bearerToken}" > /usr/share/nginx/html/bearer_token
echo "${Quix__Workspace__Id}" > /usr/share/nginx/html/workspace_id
echo "${Quix__Portal__Api}" > /usr/share/nginx/html/portal_api
echo "${processed}" > /usr/share/nginx/html/processed_topic
echo "${GoogleMapsApiKey}" > /usr/share/nginx/html/GoogleMapsApiKey
nginx -g "daemon off;"
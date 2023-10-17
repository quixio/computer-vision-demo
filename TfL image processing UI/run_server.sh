#!/bin/sh
echo "${bearerToken}" > /usr/share/nginx/html/bearer_token
echo "${Quix__Workspace__Id}" > /usr/share/nginx/html/workspace_id
echo "${Quix__Portal__Api}" > /usr/share/nginx/html/portal_api
echo "${Quix__Deployment__Id}" > /usr/share/nginx/html/Quix__Deployment__Id
echo "${processed}" > /usr/share/nginx/html/processed_topic
nginx -g "daemon off;"
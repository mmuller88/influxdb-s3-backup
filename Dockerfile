FROM influxdb:1.8.3

RUN apt update -y && apt install awscli -y

COPY influxdb-to-s3.sh /usr/bin/influxdb-to-s3

ENTRYPOINT ["/usr/bin/influxdb-to-s3"]
CMD ["cron", "0 1 * * *"]

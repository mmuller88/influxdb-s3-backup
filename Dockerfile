FROM influxdb:1.8.3

RUN apt update -y && apt install awscli cron -y

COPY influxdb-to-s3.sh /usr/bin/influxdb-to-s3.sh

ENTRYPOINT ["/usr/bin/influxdb-to-s3.sh"]
CMD ["startcron"]
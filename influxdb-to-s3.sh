#!/bin/bash

set -e

export S3_BUCKET=${S3_BUCKET}
# Check and set missing environment vars
: ${S3_BUCKET:?"S3_BUCKET env variable is required"}
: ${AWS_SECRET_ACCESS_KEY:?"AWS_SECRET_ACCESS_KEY env variable is required"}
: ${AWS_ACCESS_KEY_ID:?"AWS_ACCESS_KEY_ID env variable is required"}
if [[ -z ${S3_KEY_PREFIX} ]]; then
  export S3_KEY_PREFIX=""
else
  if [ "${S3_KEY_PREFIX: -1}" != "/" ]; then
    export S3_KEY_PREFIX="${S3_KEY_PREFIX}/"
  fi
fi
: ${DATABASE:?"DATABASE env variable is required"}
export BACKUP_PATH=${BACKUP_PATH:-/data/influxdb/backup}
export BACKUP_ARCHIVE_PATH=${BACKUP_ARCHIVE_PATH:-${BACKUP_PATH}.tgz}
export DATABASE_HOST=${DATABASE_HOST:-localhost}
export DATABASE_PORT=${DATABASE_PORT:-8088}
export DATABASE_META_DIR=${DATABASE_META_DIR:-/var/lib/influxdb/meta}
export DATABASE_DATA_DIR=${DATABASE_DATA_DIR:-/var/lib/influxdb/data}
# export CRON=${CRON:-"0 1 * * *"}
export CRON=${CRON:-"* * * * *"}
export DATETIME=$(date "+%Y%m%d%H%M%S")

# Add this script to the crontab and start crond
startcron() {
  echo "export S3_BUCKET=$S3_BUCKET" >> $HOME/.profile
  echo "export S3_KEY_PREFIX=$S3_KEY_PREFIX" >> $HOME/.profile
  echo "export DATABASE_HOST=$DATABASE_HOST" >> $HOME/.profile
  echo "export DATABASE=$DATABASE" >> $HOME/.profile
  echo "export DATABASE_PORT=$DATABASE_PORT" >> $HOME/.profile
  echo "export BACKUP_PATH=$BACKUP_PATH" >> $HOME/.profile
  echo "export BACKUP_ARCHIVE_PATH=$BACKUP_ARCHIVE_PATH" >> $HOME/.profile
  echo "export DATETIME=$DATETIME" >> $HOME/.profile
  echo "export AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION" >> $HOME/.profile
  echo "export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID" >> $HOME/.profile
  echo "export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY" >> $HOME/.profile
  echo "Starting backup cron job with frequency '$1'"

  echo "$1 . $HOME/.profile; $0 backup >> /var/log/cron.log 2>&1" > /etc/cron.d/influxdbbackup

  cat /etc/cron.d/influxdbbackup

  # Apply cron job
  crontab /etc/cron.d/influxdbbackup

  # Create the log file to be able to run tail
  touch /var/log/cron.log

  # cat /var/spool/cron/crontabs/root
  cron && tail -f /var/log/cron.log
}

# Dump the database to a file and push it to S3
backup() {
  # Dump database to directory
  echo "Backing up $DATABASE to $BACKUP_PATH"
  if [ -d $BACKUP_PATH ]; then
    rm -rf $BACKUP_PATH
  fi
  mkdir -p $BACKUP_PATH
  influxd backup -portable -database $DATABASE -host $DATABASE_HOST:$DATABASE_PORT $BACKUP_PATH
  if [ $? -ne 0 ]; then
    echo "Failed to backup $DATABASE to $BACKUP_PATH"
    exit 1
  fi

  # Compress backup directory
  if [ -e $BACKUP_ARCHIVE_PATH ]; then
    rm -rf $BACKUP_ARCHIVE_PATH
  fi
  tar -cvzf $BACKUP_ARCHIVE_PATH $BACKUP_PATH

  # Push backup file to S3
  echo "Sending file to S3"
  if aws s3 rm s3://${S3_BUCKET}/${S3_KEY_PREFIX}latest.tgz; then
    echo "Removed latest backup from S3"
  else
    echo "No latest backup exists in S3"
  fi
  if aws s3 cp $BACKUP_ARCHIVE_PATH s3://${S3_BUCKET}/${S3_KEY_PREFIX}latest.tgz; then
    echo "Backup file copied to s3://${S3_BUCKET}/${S3_KEY_PREFIX}latest.tgz"
  else
    echo "Backup file failed to upload"
    exit 1
  fi
  if aws s3api copy-object --copy-source ${S3_BUCKET}/${S3_KEY_PREFIX}latest.tgz --key ${S3_KEY_PREFIX}${DATETIME}.tgz --bucket $S3_BUCKET; then
    echo "Backup file copied to s3://${S3_BUCKET}/${S3_KEY_PREFIX}${DATETIME}.tgz"
  else
    echo "Failed to create timestamped backup"
    exit 1
  fi

  echo "Done"
}

# Pull down the latest backup from S3 and restore it to the database
restore() {
  # Remove old backup file
  if [ -d $BACKUP_PATH ]; then
    echo "Removing out of date backup"
    rm -rf $BACKUP_PATH
  fi
  if [ -e $BACKUP_ARCHIVE_PATH ]; then
    echo "Removing out of date backup"
    rm -rf $BACKUP_ARCHIVE_PATH
  fi
  # Get backup file from S3
  echo "Downloading latest backup from S3"
  if aws s3 cp s3://${S3_BUCKET}/${S3_KEY_PREFIX}latest.tgz $BACKUP_ARCHIVE_PATH; then
    echo "Downloaded"
  else
    echo "Failed to download latest backup"
    exit 1
  fi

  # Extract archive
  tar -xvzf $BACKUP_ARCHIVE_PATH -C /

  # Restore database from backup file
  echo "Running restore"
  if influxd restore -database $DATABASE -datadir $DATABASE_DATA_DIR -metadir $DATABASE_META_DIR $BACKUP_PATH ; then
    echo "Successfully restored"
  else
    echo "Restore failed"
    exit 1
  fi
  echo "Done"

}

# Handle command line arguments
case "$1" in
  "startcron")
    startcron "$CRON"
    ;;
  "backup")
    backup
    ;;
  "restore")
    restore
    ;;
  *)
    echo "Invalid command '$@'"
    echo "Usage: $0 {backup|restore|startcron}"
esac

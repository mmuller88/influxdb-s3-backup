const { NodeProject, ProjectType, DockerCompose } = require('projen');

const project = new NodeProject({
  authorAddress: 'damadden88@googlemail.de',
  authorName: 'Martin Mueller',
  name: 'influxdb-s3-backup',
  releaseBranches: 'main',
  projectType: ProjectType.LIB,

});

new DockerCompose(project, {
  version: '3.9',
  services: {
    influxdbs3backup: {
      imageBuild: {
        context: '.',
      },
      environment: {
        DATABASE: 'mydatabase',
        DATABASE_HOST: '1.2.3.4',
        S3_BUCKET: 'mybackupbucket',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_DEFAULT_REGION: 'us-west-2',
      },
    }
},
});

project.synth();

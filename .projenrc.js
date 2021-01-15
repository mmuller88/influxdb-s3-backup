const { NodeProject, ProjectType, DockerCompose } = require('projen');

const project = new NodeProject({
  authorAddress: 'damadden88@googlemail.de',
  authorName: 'Martin Mueller',
  name: 'influxdb-s3-backup',
  releaseBranches: 'main',
  projectType: ProjectType.LIB,
});

const dockerPush = project.github.addWorkflow('push-docker');

dockerPush.addJobs({
  publish_docker_hub: {
    // 'name': 'Release to NPM',
    // 'needs': this.releaseWorkflowJobId,
    'runs-on': 'ubuntu-latest',
    env: {
      CI: "true",
    },
    'steps': [
      {
        name: 'Check out the repo',
        uses: 'actions/checkout@v2',
      },
      {
        name: 'Push to Docker Hub',
        uses: 'docker/build-push-action@v1',
        with: {
          username: '${{ secrets.DOCKER_USERNAME }}',
          password: '${{ secrets.DOCKER_PASSWORD }}',
          repository: 'damadden88/influxdb-s3-backup',
          tag_with_ref: true,
        },
      },
    ],
  }
})

dockerPush.on({
  release: {
    types: ['published'],
  },
  workflow_dispatch: {},
})

new DockerCompose(project, {
  version: '3.3',
  services: {
    influxdb:{
      // container_na me: influxdb,
      image: "influxdb:latest",
      environment: {
        INFLUXDB_DB: 'mydb',
        INFLUXDB_BIND_ADDRESS: '0.0.0.0:8088',
      },
    },
    influxdbs3backup: {
      imageBuild: {
        context: '.',
      },
      environment: {
        DATABASE: 'mydb',
        DATABASE_HOST: 'influxdb',
        S3_BUCKET: 'mybackupbucket',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        AWS_DEFAULT_REGION: 'us-west-2',
      },
    },
  },
});

project.synth();

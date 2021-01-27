const { NodeProject, ProjectType, DockerCompose } = require('projen');

const project = new NodeProject({
  authorAddress: 'damadden88@googlemail.de',
  authorName: 'Martin Mueller',
  name: 'influxdb-s3-backup',
  releaseBranches: 'main',
  projectType: ProjectType.LIB,
});

project.releaseWorkflow.addJobs({
  publish_docker_hub: {
    needs: 'build',
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
        name: 'Set up QEMU',
        uses: 'docker/setup-qemu-action@v1',
      },
      {
        name: 'Set up Docker Buildx',
        uses: 'docker/setup-buildx-action@v1',
      },
      {
        name: 'Login to DockerHub',
        uses: 'docker/login-action@v1',
        with:{
          username: '${{ secrets.DOCKER_USERNAME }}',
          password: '${{ secrets.DOCKER_PASSWORD }}',
        }
      },
      {
        name: 'get_version',
        id: 'get_version',
        run: [
          'DVERSION=$(jq .version version.json -r)',
          'echo "::set-output name=dversion::$DVERSION"',
          ].join('\n'),
      },
      {
        name: 'Build and push',
        uses: 'docker/build-push-action@v2',
        with: {
          context: '.',
          file: './Dockerfile',
          platforms: 'linux/amd64,linux/arm64',
          push: true,
          tags: 'damadden88/influxdb-s3-backup:${{ steps.get_version.outputs.dversion }},damadden88/influxdb-s3-backup:latest'
        }
      },
    ],
  }
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
        S3_BUCKET: 'rasp4backup',
        // AWS_ACCESS_KEY_ID: '',
        // AWS_SECRET_ACCESS_KEY: '',
        AWS_DEFAULT_REGION: 'us-west-2',
      },
    },
  },
});

project.synth();

const { NodeProject, ProjectType, DockerCompose } = require('projen');

const project = new NodeProject({
  authorAddress: 'damadden88@googlemail.de',
  authorName: 'Martin Mueller',
  name: 'influxdb-s3-backup',
  releaseBranches: 'main',
  projectType: ProjectType.LIB,
});

// const release =project.github.tasks.tryFind('release');
// release.exec('hihi');

// const versionJSON = require('./version.json')

project.releaseWorkflow.addJobs({
  publish_docker_hub: {
    needs: 'build',
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
        name: "getVersion",
        run: [
          'JSON=$(cat ./version.json)',
          'echo "::set-output name=version::${JSON//\'%\'/\'%25\'}"',
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
          // tags: `damadden88/influxdb-s3-backup:${versionJSON.version}`
          tags: 'damadden88/influxdb-s3-backup:${{fromJson(steps.getVersion.outputs.version).version}}'
        }
      },
      // {
      //   name: 'Push to Docker Hub',
      //   uses: 'docker/build-push-action@v2',
      //   with: {
      //     username: '${{ secrets.DOCKER_USERNAME }}',
      //     password: '${{ secrets.DOCKER_PASSWORD }}',
      //     repository: 'damadden88/influxdb-s3-backup',
      //     tag_with_ref: true,
      //   },
      // },
    ],
  }
})

// const dockerPush = project.github.addWorkflow('push-docker');
const dockerPush = project.github.addWorkflow('push-docker');

// dockerPush.addJobs({
//   publish_docker_hub: {
//     // 'name': 'Release to NPM',
//     // 'needs': this.releaseWorkflowJobId,
//     'runs-on': 'ubuntu-latest',
//     env: {
//       CI: "true",
//     },
//     'steps': [
//       {
//         name: 'Check out the repo',
//         uses: 'actions/checkout@v2',
//       },
//       {
//         name: 'Set up QEMU',
//         uses: 'docker/setup-qemu-action@v1',
//       },
//       {
//         name: 'Set up Docker Buildx',
//         uses: 'docker/setup-buildx-action@v1',
//       },
//       {
//         name: 'Login to DockerHub',
//         uses: 'docker/login-action@v1',
//         with:{
//           username: '${{ secrets.DOCKER_USERNAME }}',
//           password: '${{ secrets.DOCKER_PASSWORD }}',
//         }
//       },
//       {
//         name: 'Build and push',
//         uses: 'docker/build-push-action@v2',
//         with: {
//           context: '.',
//           file: './Dockerfile',
//           platforms: 'linux/amd64,linux/arm64',
//           push: true,
//           tags: 'damadden88/influxdb-s3-backup:latest'
//         }
//       },
//       // {
//       //   name: 'Push to Docker Hub',
//       //   uses: 'docker/build-push-action@v2',
//       //   with: {
//       //     username: '${{ secrets.DOCKER_USERNAME }}',
//       //     password: '${{ secrets.DOCKER_PASSWORD }}',
//       //     repository: 'damadden88/influxdb-s3-backup',
//       //     tag_with_ref: true,
//       //   },
//       // },
//     ],
//   }
// })

dockerPush.on({
  push: {
    tags: ['*'],
  },
  // release: {
  //   types: ['published'],
  // },
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
        S3_BUCKET: 'rasp4backup',
        // AWS_ACCESS_KEY_ID: '',
        // AWS_SECRET_ACCESS_KEY: '',
        AWS_DEFAULT_REGION: 'us-west-2',
      },
    },
  },
});

project.synth();

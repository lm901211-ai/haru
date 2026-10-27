// 웹 빌드를 GitHub Pages 같은 하위 경로(예: https://아이디.github.io/haru/)에 올릴 때
// WEB_BASE_URL=/haru npx expo export --platform web 처럼 경로를 지정한다.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}),
  },
});

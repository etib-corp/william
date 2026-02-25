const utilityRepo = "etib-corp/utility";
const utilityBaseCommits = {
  [utilityRepo]: "5e5e76cf451bccddaf1b38245b6085695b69f7fa"
};

process.env.GITHUB_TARGET_REPOS ??= utilityRepo;
process.env.GITHUB_BASE_COMMIT_BY_REPO ??= JSON.stringify(utilityBaseCommits);

await import("./gtest-repositories.json.js");
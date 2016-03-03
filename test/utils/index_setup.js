var assert = require("assert");
var NodeGit = require("../../");
var path = require("path");
var promisify = require("promisify-node");
var fse = promisify(require("fs-extra"));
var RepoUtils = require("../utils/repository_setup");

var IndexSetup = {
  createConflict: function createConflict(
    repository,
    _ourBranchName,
    _theirBranchName,
    _fileName
  ) {
    var fileName = _fileName || "everyonesFile.txt";

    var ourBranchName = _ourBranchName || "ours";
    var theirBranchName = _theirBranchName || "theirs";

    var baseFileContent = "How do you feel about Toll Roads?\n";
    var ourFileContent = "I like Toll Roads. I have an EZ-Pass!\n";
    var theirFileContent = "I'm skeptical about Toll Roads\n";

    var ourSignature = NodeGit.Signature.create
          ("Ron Paul", "RonPaul@TollRoadsRBest.info", 123456789, 60);
    var theirSignature = NodeGit.Signature.create
          ("Greg Abbott", "Gregggg@IllTollYourFace.us", 123456789, 60);

    var ourCommit;
    var ourBranch;
    var theirBranch;

    return fse.writeFile(
      path.join(repository.workdir(), fileName),
      baseFileContent
    )
      .then(function() {
        return RepoUtils.addFileToIndex(repository, fileName);
      })
      .then(function(oid) {
        return repository.createCommit("HEAD", ourSignature,
          ourSignature, "initial commit", oid, []);
      })
      .then(function(commitOid) {
        return repository.getCommit(commitOid).then(function(commit) {
          ourCommit = commit;
        }).then(function() {
          console.log("after creating base commit");
          return repository.createBranch(ourBranchName, commitOid)
            .then(function(branch) {
              console.log("after creating our branch");
              ourBranch = branch;
              return repository.createBranch(theirBranchName, commitOid);
            });
        });
      })
      .then(function(branch) {
        console.log("after creating their commit");

        theirBranch = branch;
        return fse.writeFile(path.join(repository.workdir(), fileName),
          baseFileContent + theirFileContent);
      })
      .then(function() {
        return RepoUtils.addFileToIndex(repository, fileName);
      })
      .then(function(oid) {
        return repository.createCommit(theirBranch.name(), theirSignature,
          theirSignature, "they made a commit", oid, [ourCommit]);
      })
      .then(function(commitOid) {
        return fse.writeFile(path.join(repository.workdir(), fileName),
          baseFileContent + ourFileContent);
      })
      .then(function() {
        return RepoUtils.addFileToIndex(repository, fileName);
      })
      .then(function(oid) {
        return repository.createCommit(ourBranch.name(), ourSignature,
            ourSignature, "we made a commit", oid, [ourCommit]);
      })
      .then(function(commitOid) {
        var opts = {
          checkoutStrategy: NodeGit.Checkout.STRATEGY.FORCE
        };

        return NodeGit.Checkout.head(repository, opts);
      })
      .then(function() {
        return repository.mergeBranches(ourBranchName, theirBranchName);
      })
      .then(function(commit) {
        assert.fail(commit, undefined,
          "The index should have been thrown due to merge conflicts");
      })
      .catch(function(index) {
        assert.ok(index);
        assert.ok(index.hasConflicts());

        return index.conflictGet(fileName);
      });
  }
};

module.exports = IndexSetup;
const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");
const jwt = require("jsonwebtoken");

exports.doesUsernameExist = function (req, res) {
  User.findByUsername(req.body.username)
    .then(() => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};

exports.doesEmailExist = async function (req, res) {
  let emailBool = await User.doesEmailExist(req.body.email);
  res.json(emailBool);
};

exports.sharedProfileData = async function (req, res, next) {
  let isVisitorsProfile = false;
  let isFollowing = false;
  if (req.session.user) {
    isVisitorsProfile = req.profileUser._id.equals(req.session.user._id);
    isFollowing = await Follow.isVisitorFollower(req.profileUser._id, req.visitorId);
  }

  req.isVisitorsProfile = isVisitorsProfile;
  req.isFollowing = isFollowing;

  //retrieve post, follower & followingcounts
  let postCountPromise = Post.countPostsByAuthor(req.profileUser._id);
  let followerCountPromise = Follow.countFollowersById(req.profileUser._id);
  let followingCountPromise = Follow.countFollowingById(req.profileUser._id);
  let [postCount, followerCount, followingCount] = await Promise.all([postCountPromise, followerCountPromise, followingCountPromise]);

  req.profileCounts = {
    postCount: postCount,
    followerCount: followerCount,
    followingCount: followingCount,
  };

  next();
};

exports.mustBeLoggedIn = function (req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash("errors", "You must be logged in to perform that action.");
    req.session.save(() => {
      res.redirect("/");
    });
  }
};

exports.login = function (req, res) {
  let user = new User(req.body);
  user
    .login()
    .then((result) => {
      req.session.user = { username: user.data.username, avatar: user.avatar, _id: user.data._id };
      req.session.save(() => {
        res.redirect("/");
      });
    })
    .catch((e) => {
      req.flash("errors", e);
      req.session.save(() => {
        res.redirect("/");
      });
    });
};

exports.logout = function (req, res) {
  req.session.destroy(function () {
    res.redirect("/");
  });
};

exports.register = async function (req, res) {
  let user = new User(req.body);
  user
    .register()
    .then(() => {
      req.session.user = { username: user.data.username, avatar: user.avatar, _id: user.data._id };
      req.session.save(() => {
        res.redirect("/");
      });
    })
    .catch((regErrors) => {
      regErrors.forEach((error) => {
        req.flash("regErrors", error);
      });
      req.session.save(() => {
        res.redirect("/");
      });
    });
};

exports.home = async function (req, res) {
  if (req.session.user) {
    // fetch feed of posts for current user
    let posts = await Post.getFeed(req.session.user._id);
    res.render("home-dashboard", { posts: posts, title: "Home Page Feed" });
  } else {
    res.render("home-guest", { regErrors: req.flash("regErrors") });
  }
};

exports.ifUserExists = function (req, res, next) {
  User.findByUsername(req.params.username)
    .then((userDocument) => {
      req.profileUser = userDocument;
      next();
    })
    .catch(() => {
      res.render("404", { title: "Oops" });
    });
};

exports.profilePostsScreen = function (req, res) {
  // ask our post model for posts by a certain author id
  Post.findByAuthorId(req.profileUser._id)
    .then((posts) => {
      res.render("profile", {
        title: `Profile for ${req.profileUser.username}`,
        currentPage: "posts",
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        profileCounts: req.profileCounts,
      });
    })
    .catch(() => {
      res.render("404", { title: "Oops" });
    });
};

exports.profileFollowersScreen = async function (req, res) {
  try {
    let followers = await Follow.getFollowersById(req.profileUser._id);
    res.render("profile-followers", {
      title: `Profile for ${req.profileUser.username}`,
      currentPage: "followers",
      followers: followers,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      profileCounts: req.profileCounts,
    });
  } catch {
    res.render("404", { title: "Oops" });
  }
};

exports.profileFollowingScreen = async function (req, res) {
  try {
    let follows = await Follow.getFollowsById(req.profileUser._id);
    res.render("profile-following", {
      title: `Profile for ${req.profileUser.username}`,
      currentPage: "following",
      follows: follows,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      profileCounts: req.profileCounts,
    });
  } catch {
    res.render("404", { title: "Oops" });
  }
};

// API functions

exports.apiLogin = function (req, res) {
  let user = new User(req.body);
  user
    .login()
    .then((result) => {
      res.json(jwt.sign({ _id: user.data._id }, process.env.JWTSECRET, { expiresIn: "7d" }));
    })
    .catch((e) => {
      res.json("Sorry, your credentials are not valid.");
    });
};

exports.apiMustBeLoggedIn = function (req, res, next) {
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET);
    next();
  } catch {
    res.json("Sorry, you must provide a valid token to perform that action.");
  }
};

exports.apiGetPostsByUsername = async function (req, res) {
  try {
    let authorDoc = await User.findByUsername(req.params.username);
    let posts = await Post.findByAuthorId(authorDoc._id);
    res.json(posts);
  } catch {
    res.json("Sorry, invalid user requested.");
  }
};

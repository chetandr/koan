'use strict';

/**
 * Posts controller for serving user posts.
 */

var route = require('koa-route'),
    parse = require('co-body'),
    mongo = require('../config/mongo'),
    ws = require('../config/ws'),
    ObjectID = mongo.ObjectID;

// register koa routes
exports.init = function (app) {
  app.use(route.get('/api/posts', listPosts));
  app.use(route.post('/api/posts', createPost));
  app.use(route.post('/api/posts/:postId/comments', createComment));
};

/**
 * Lists last 15 posts with latest 15 comments in them.
 */
function *listPosts() {
  var posts = yield mongo.posts.find(
      {},
      {comments: {$slice: -15 /* only get last x many comments for each post */}},
      {limit: 15, sort: {_id: -1}} /* only get last 15 posts */).toArray();
  posts.forEach(function (post) {
    post.id = post._id.toString();
    delete post._id;
  });
  this.body = posts;
}

/**
 * Saves a new post in the database after proper validations.
 */
function *createPost() {
  var post = yield parse(this);
  // todo: validate post body here w/ koa-validator
  post.from = this.user;
  post.createdTime = new Date();
  var results = yield mongo.posts.insert(post);

  this.status = 201;
  this.body = results[0]._id.toString();

  // now notify everyone about this new post
  post.id = post._id;
  delete post._id;
  ws.notify('posts.created', post);
}

/**
 * Appends a new comment to a given post.
 * @param id Post ID.
 */
function *createComment(postId) {
  postId = new ObjectID(postId);
  var comment = yield parse(this);
  var commentId = new ObjectID();

  // update post document with the new comment
  comment = {_id: commentId, from: this.user, createdTime: new Date(), message: comment.message};
  var result = yield mongo.posts.update(
      {_id: postId},
      {$push: {comments: comment}}
  );

  this.status = 201;
  this.body = commentId.toString();

  // now notify everyone about this new comment
  comment.id = comment._id;
  delete comment._id;
  ws.notify('posts.comments.created', comment);
}
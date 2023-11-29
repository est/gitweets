## 这是啥 What is this?

This is @est's fork of Yan's janky twitter replacement.

在线 demo： https://f.est.im/

一位叫 朱颜 的大神做了个神奇的 [twitter 替代品——基于git](https://twitter.com/bcrypt/status/1588416861552582657)。这个版本是 @est 的二次开发和封装

> RT @bcrypt:
> 
> just made a “decentralized” “alternative” to twitter; everyone should go “join” it   
>    
> to make an account: fork https://github.com/diracdeltas/tweets   
> to tweet: `git commit --allow-empty`   
> to follow someone: `git remote add <alias> <their fork url>`   
> to retweet: `git cherry-pick <their “tweet”>`   

设想一下，一个 git repo 就能长久保存你的网络短篇废话，而且挂一个静态站就能随时随地展示你的时间轴，岂不妙哉。

## 搭建 Setup

* fork https://github.com/est/gitweets

## 使用 Stuff you can do

### 本地命令行：

* 发文本 posting text: `make post "blah"`
* 发图片 posting pics: `make post "some pics:" static/2023/1015-01.webp`

## 待办 ToDo:

* [X] ~~[verifications](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)~~
* [X] ~~404.html for single-page-app routing~~
* [X] ~~用 blob API 发图~~
* [X] ~~多图 flexbox 布局~~  玩不动了。就酱
* [X] ~~login with Github~~
  * [X] ~~[app](https://github.com/organizations/CloudColonizer/settings/applications/2352861)~~
  * [X] ~~[Web page login](https://github.com/login/oauth/authorize?client_id=822bbd6320f8bae0de63) [doc]](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [client_id/client_secret](https://docs.github.com/en/rest/overview/authenticating-to-the-rest-api)~~
  * [X] ~~Cloudflare [Pages with Functions](https://developers.cloudflare.com/pages/platform/functions/get-started/) 解决 CORS~~
* [ ] post with Github
  * [X] ~~[scope](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)~~
  * [X] ~~[star](https://docs.github.com/en/rest/activity/starring?apiVersion=2022-11-28#) it~~
  * [X] ~~[rate limit](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api?apiVersion=2022-11-28#primary-rate-limit-for-oauth-apps)
  * [X] ~~fork it~~
  * [X] ~~`--allow-empty` with same Tree SHA~~
  * [X] make commit
  * [X] create [pull request](https://docs.github.com/en/rest/pulls/pulls)
  * [X] ~~use js module import~~
  * [ ] [join org](https://docs.github.com/en/rest/orgs/members)
  * [ ] hide access_token in URL fragments
  * [ ] edit layout, add the post textarea and button
* [ ] 移动端响应式布局 🤣
* [ ] fix long text
* [ ] 翻页 API
* [ ] 视频、音频控件
* [ ] 避免 N+1 获取文件
  * [ ] [contens API](https://api.github.com/repos/est/gitweets/contents/static%2F2023)
  * [X] ~~[... on Tree](https://github.com/orgs/community/discussions/24496)~~
* [ ] 网址 microformats 支持卡片
* [ ] non-github API 支持：gitlab等
* [ ] 本地 `make` 生成 .json 静态页面
* [ ] `make delete` 方法

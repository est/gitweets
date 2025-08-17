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

## OAuth with github

https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
https://docs.github.com/en/rest/overview/authenticating-to-the-rest-api


https://docs.github.com/en/rest/activity/starring?apiVersion=2022-11-28#star-a-repository-for-the-authenticated-user
https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#create-a-pull-request


https://github.com/organizations/CloudColonizer/settings/applications/2352861
https://github.com/login/oauth/authorize?client_id=822bbd6320f8bae0de63

https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#create-an-organization-invitation

## 待办 ToDo:

* [X] ~~[verifications](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)~~
* [X] ~~404.html for single-page-app routing~~
* [X] ~~用 blob API 发图~~
* [X] ~~多图 flexbox 布局~~  玩不动了。就酱
* [X] 分页，post 按钮和textarea (20250816)
* [ ] login with Github
* [ ] Cloudflare [Pages with Functions](https://developers.cloudflare.com/pages/platform/functions/get-started/)
* [ ] 移动端响应式布局 🤣
* [ ] 视频、音频控件
* [ ] 网址 microformats 支持卡片
* [ ] non-github API 支持：gitlab等
* [ ] 本地 make 静态页面
* [ ] `make delete` 方法
* [ ] fix long text
* [ ] 翻页 API

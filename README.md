## 这是啥 What is this?

This is @est's fork of Yan's janky twitter replacement.

demo： https://f.est.im/

一位叫 朱颜 的大神做了个神奇的 [twitter 替代品——基于git](https://twitter.com/bcrypt/status/1588416861552582657)。这个版本是 @est 的二次开发和封装

> RT @bcrypt:
> 
> just made a “decentralized” “alternative” to twitter; everyone should go “join” it   
>    
> to make an account: fork https://github.com/diracdeltas/tweets   
> to tweet: `git commit --allow-empty`   
> to follow someone: `git remote add <alias> <their fork url>`   
> to retweet: `git cherry-pick <their “tweet”>`   

Your GIT commit messages as a microblogging service. A single html that renders github commit history as a feed timeline. You can static host your personal tweets anywhere. Make a tweet via Github REST API in the browser in case you don't have `git` locally.

Post images: commit along with image files under `./static` path. The commit message must end with `:` (to reduce API calls to github.com). [Example](https://f.est.im/est/e0d4c46445517ba52ceda06d788e09760aaccce5)

设想一下，一个 git repo 就能长久保存你的网络短篇废话，而且挂一个静态站就能随时随地展示你的时间轴，岂不妙哉。本项目也有[很多坑](https://blog.est.im/2025/stdout-05)

## 搭建 Setup

* fork https://github.com/est/gitweets

## 使用 Stuff you can do

### 本地命令行 Locally ：

* 发文本 posting text: `make post "blah"`
* 发图片 posting pics: `make post "some pics:" static/2023/1015-01.webp`
* 看 see history `make timeline`

### Via Github API

- feed timeline and pagination using Github REST API directly
- Make a tweet to a github repo after OAuth login via Cloudflare worker for CORS reasons
- Post pictures with attached files per commit under the `./static` path.

## 待办 ToDo:

* [ ] 多repo通过localStorag切换。并且记住上一次的
* [ ] Github app for single-repo access
* [ ] 视频、音频控件 video and audios
* [ ] 网址 microformats 支持卡片
* [ ] non-github API 支持：gitlab等
* [ ] 本地 make 静态页面
* [ ] `make delete` 方法
* [ ] fix long text
* [X] post images in browser
* [X] 移动端响应式布局 🤣
* [X] 翻页 API
* [X] ~~[verifications](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)~~
* [X] ~~404.html for single-page-app routing~~
* [X] ~~用 blob API 发图~~
* [X] ~~多图 flexbox 布局~~  玩不动了。就酱
* [X] 分页，post 按钮和textarea (20250816)
* [X] login with Github
* [X] ~~github REST API发帖~~  被CORS拦了。
* [X] Cloudflare [Pages with Functions](https://developers.cloudflare.com/pages/platform/functions/get-started/)  中转一下

## 这是啥 What is this?

This is @est's fork of Yan's janky twitter replacement.

一位叫 朱颜 的大神做了个神奇的 [twitter 替代品——基于git](https://twitter.com/bcrypt/status/1588416861552582657)。这个版本是 @est 的二次开发和封装


> RT @bcrypt:
> 
> just made a “decentralized” “alternative” to twitter; everyone should go “join” it
> 
> to make an account: fork https://github.com/diracdeltas/tweets
> to tweet: `git commit --allow-empty`
> to follow someone: `git remote add <alias> <their fork url>`
> to retweet: `git cherry-pick <their “tweet”>`

设想一下，一个 git repo 就能长久保存你的网络短废话，而且挂一个静态站就能随时随地展示你的时间轴，岂不妙哉。

## 搭建 Setup

* fork https://github.com/est/gittweets


## 使用 Stuff you can do

### 本地命令行：

* 发帖 to post:
```
make post "blah"
```

## 待办 ToDo:

- [X] [verifications](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
- [ ] 用 blob API 发图
- [ ] non-github API 支持：gitlab等
- [ ] 本地 make 静态页面

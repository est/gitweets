.PHONY: help post post-img delete comment delete-comment comments list show timeline refresh repost push

# 默认显示帮助
help:
	@echo "gitweets - Git commit 微博"
	@echo ""
	@echo "发帖 Posting:"
	@echo "  make post 'my tweet'           发文本"
	@echo "  make post-img 'msg' file       发图片"
	@echo "  make post-img 'msg' f1 f2 ...  发多图"
	@echo ""
	@echo "删除 Deleting:"
	@echo "  make delete                    删除最近一条 post"
	@echo "  make delete-comment SHA ID     删除评论"
	@echo ""
	@echo "评论 Comments:"
	@echo "  make comment SHA NAME TEXT     添加评论"
	@echo "  make comments SHA              查看评论"
	@echo ""
	@echo "查看 Viewing:"
	@echo "  make list                      最近 20 条"
	@echo "  make show SHA                  post 详情"
	@echo "  make timeline                  完整 log"
	@echo ""
	@echo "同步 Sync:"
	@echo "  make refresh                   git fetch"
	@echo "  make push                      git push"
	@echo "  make repost SHA                cherry-pick"

# 发文本
post:
	@test -n '$(p)' || { echo "用法: make post '内容'"; exit 1; }
	git add static -A 2>/dev/null || true
	git commit --allow-empty -m '$(p)'
	@echo "✓ 已发布"

# 发图片
post-img:
	@test -n '$(p)' || { echo "用法: make post-img '内容' file [...]"; exit 1; }
	@# 消息以 : 结尾表示有图片
	@msg='$(p)'; case "$$msg" in *:) ;; *) msg="$$msg:" ;; esac
	git add $(wordlist 2,99,$(MAKECMDGOALS)) && git commit -m "$$msg"
	@echo "✓ 已发布（含图片）"

# 删除最近一条 post
delete:
	@sha=$$(git rev-parse HEAD); \
	msg=$$(git log -1 --format='%s'); \
	echo "即将删除: $$sha"; \
	echo "  $$msg"; \
	read -p "确认? (y/N) " ans; \
	[ "$$ans" = "y" ] || { echo "已取消"; exit 0; }; \
	git reset --hard HEAD~1; \
	echo "✓ 已删除"

# 添加评论 (git notes)
# 用法: make comment SHA=abc NAME=foo TEXT=bar
comment:
	@test -n '$(SHA)' || { echo "用法: make comment SHA=xxx NAME=名字 TEXT=内容"; exit 1; }
	@test -n '$(NAME)' || { echo "用法: make comment SHA=xxx NAME=名字 TEXT=内容"; exit 1; }
	@test -n '$(TEXT)' || { echo "用法: make comment SHA=xxx NAME=名字 TEXT=内容"; exit 1; }
	@id="c_$$(head -c 6 /dev/urandom | xxd -p)"; \
	ts=$$(date +%s); \
	printf '{"type":"comment","name":"%s","text":"%s","id":"%s","ts":%d}' \
		'$(NAME)' '$(TEXT)' "$$id" "$$ts" \
		| git notes --ref=commits add -f -F - $(SHA) 2>/dev/null \
		|| printf '{"type":"comment","name":"%s","text":"%s","id":"%s","ts":%d}' \
			'$(NAME)' '$(TEXT)' "$$id" "$$ts" \
			| git notes --ref=commits append -f -F - $(SHA); \
	echo "✓ 评论已添加 ($$id)"

# 删除评论 (追加 delete_comment 事件)
# 用法: make delete-comment SHA=xxx ID=yyy
delete-comment:
	@test -n '$(SHA)' || { echo "用法: make delete-comment SHA=xxx ID=评论ID"; exit 1; }
	@test -n '$(ID)' || { echo "用法: make delete-comment SHA=xxx ID=评论ID"; exit 1; }
	@printf '{"type":"delete_comment","target":"%s"}' '$(ID)' \
		| git notes --ref=commits append -f -F - $(SHA)
	@echo "✓ 评论已删除 ($(ID))"

# 查看评论
comments:
	@test -n '$(SHA)' || { echo "用法: make comments SHA=xxx"; exit 1; }
	@echo "--- 评论 ---"
	@git notes --ref=commits show $(SHA) 2>/dev/null \
		| python3 -c "\
import sys,json;\
e=[json.loads(x) for x in sys.stdin.read().splitlines() if x.strip()];\
d={x['target'] for x in e if x.get('type')=='delete_comment'};\
[print(f'  [{c[\"id\"]}] {c[\"name\"]}: {c[\"text\"]}') for c in e if c.get('type')=='comment' and c['id'] not in d]" \
		|| echo "  (无评论)"

# 最近 20 条 post
list:
	@echo "--- 最近 20 条 post ---"
	@git log --oneline -20 --format='%C(yellow)%h%C(reset) %s %C(dim)(%cr)%C(reset)'

# 查看某条 post
show:
	@test -n '$(SHA)' || { echo "用法: make show SHA=xxx"; exit 1; }
	@git log -1 --format='%C(yellow)%H%C(reset)%n%an <%ae>%n%ai%n%n%s%n%n%b' $(SHA)
	@echo ""
	@$(MAKE) comments SHA=$(SHA) --no-print-directory

# 完整 timeline
timeline:
	@git log --graph --all --decorate --oneline

# fetch 远程
refresh:
	git fetch --all

# push
push:
	git push

# cherry-pick
repost:
	@test -n '$(p)' || { echo "用法: make repost SHA"; exit 1; }
	git cherry-pick $(p)

# 把多余参数当目标时不报错 (用于 post-img 的文件列表)
%:
	@:

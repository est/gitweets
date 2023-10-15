.PHONY: go

go:
	@echo "usage:"
	@echo "  make post 'my tweet here'"
	@echo "  make refresh  # get all tweets"
	@echo "  make repost <id>"
	@echo "  make timeline # show my timeline"

post:
	git add static
	git commit --allow-empty -m $(p) 
	git push

refresh:
	git fetch --all

repost:
	git cherry-pick $(p)

timeline:
	git log --graph --all --decorate --oneline

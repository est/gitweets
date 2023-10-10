.PHONY: go

go:
	@echo "usage:"
	@echo "  make post 'my tweet here'"
	@echo "  make refresh  # get all tweets"
	@echo "  make repost"
	@echo "  make timeline # show my timeline"

post:
	git commit -m $(p) --allow-empty
	git push

refresh:
	git fetch --all

repost:
	git cherry-pick $(p)

timeline:
	git log --graph --all --decorate --oneline

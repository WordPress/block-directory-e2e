# Block Directory Block Health Check
![](https://github.com/StevenDufresne/block-directory-e2e/workflows/Block%20Health%20Check/badge.svg)

This project will run E2E tests to make sure a block is passing basic Gutenberg tests.

## To run the tests locally…

**Install Block Testing Framework**

	npm ci

**Configure & Start Environment**

	npm run wp-env start

**Modify folder permissions**

	docker exec -t $( docker ps -qf "name=tests" ) chmod -R 767 /var/www/html/wp-content

**Run End to End Tests**

	npm run test:e2e
	
For interactive tests

	npm run test:e2e:interactive

## To trigger the actions on GitHub

1. Generate a personal token in Settings > Developer Settings > Personal Access Tokens
2. Use the token to trigger a github action via API (replace the `{account}/{repo}` with your fork):

	curl -H "Authorization: token $GITHUB_PERSONAL_TOKEN" -H 'Accept: application/vnd.github.everest-preview+json' "https://api.github.com/repos/{account}/{repo}/dispatches" -d '{"event_type": "Test Block", "client_payload": {"slug": "plugin-slug" }}'

3. The action will appear in the "Actions" section of your repo.

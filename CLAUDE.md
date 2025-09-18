Can you create a ContainerManager service that runs on a remote server that can create/delete/interact with docker containers on that remote server which behave like WebContainers?   The ContainerManager will create a docker container on that system with a websocket that my AgentApp client can also connect with and interact directly with that ephemeral docker container.
Initial container setup or termination is handled by the ContainerManager service but all other interactions with the running docker container should be via the websocket that the ContainerManager created initially.
Provide endpoints as close as possible to resemble the WebContainer API so that I can swap out the API calls on the client AgentApp to change from using WebContainers to these new services and API endpoints.
Use nextjs, approuter, react, nodejs, typescript with materialui and tailwind.css for front end
Use nestjs, nodejs, and typescript on the back end.
Create a monorepo file structure using best practices.
Use turbopack when possible.
Use eslint.
![img.png](img.png)

# Consoomer

Consoomer is the python vectorization backend for Filefly that consumes vectorization tasks off of a RabbitMQ queue and processes them into embeddings

It **should**:

- Download the files
- Handle caching of the downloaded files
- Vectorize the files w/ embeddings
- Handle embedding caching
- Call the provided Next.js webhook API with the processed embedding

It **should not**:

- Handle any kind of authentication (this will be run as a microservice in a kube cluster, scaling up and down as needed)
- Store any kind of state (this will be handled by the Next.js API)
- Store files past just the time needed to process them (use /tmp)
- Upload the final embeddings into the vector store (this will be handled by the Next.js API)

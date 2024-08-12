"""Main module for the Filefly consumer, which is responsible for file vectorization."""

import asyncio
import os
from functools import partial

import aio_pika
from aio_pika import IncomingMessage
from dotenv import load_dotenv
from prisma import Prisma
from redis.asyncio import Redis


# pylint: disable=missing-function-docstring
def load_env_files() -> None:
    # Load .env.local first (if it exists)
    if os.path.exists(".env.local"):
        load_dotenv(".env.local")

    # Load .env second, allowing it to override .env.local
    load_dotenv(".env")

    # You can add more specific .env files here if needed
    # For example: .env.development.local, .env.test.local, etc.


# pylint: disable=unused-argument
async def message_callback(prisma: Prisma, cache: Redis, message: IncomingMessage) -> None:
    """Callback function for processing messages from the vectorize queue."""

    async with message.process():
        pass  # process the message here, it will nack if an exception is raised


async def main() -> None:
    """Main function for the Filefly consumer."""
    load_env_files()

    prisma = Prisma()
    await prisma.connect()

    broker = await aio_pika.connect_robust(os.environ["BROKER_URL"])

    cache = Redis.from_url(os.environ["CACHE_URL"])

    partial_callback = partial(message_callback, prisma, cache)

    async with broker:
        channel = await broker.channel()
        await channel.set_qos(prefetch_count=1)

        queue = await channel.declare_queue("vectorize", durable=True)

        await queue.consume(partial_callback)

        print(" [*] Waiting for messages. To exit press CTRL+C")

        try:
            await asyncio.Future()  # Run forever
        finally:
            await broker.close()
            await cache.close()
            await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(main())

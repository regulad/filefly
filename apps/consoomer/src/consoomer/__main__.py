"""Main module for the Filefly consumer, which is responsible for file vectorization."""

import asyncio

from prisma import Prisma


async def main() -> None:
    """Main function for the Filefly consumer."""
    prisma = Prisma()
    await prisma.connect()

    # code here

    await prisma.disconnect()


if __name__ == "__main__":
    asyncio.run(main())

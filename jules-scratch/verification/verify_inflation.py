import asyncio
from playwright.async_api import async_playwright, expect
import pathlib

async def main():
    file_path = pathlib.Path.cwd() / "inflationary_solution.html"
    file_url = f"file://{file_path.resolve()}"

    print(f"Navigating to: {file_url}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(file_url, wait_until="networkidle")

        # 1. Check initial state
        print("Checking initial state...")
        await expect(page.locator("#monopole-count")).not_to_contain_text("N/A")
        initial_count_text = await page.locator("#monopole-count").text_content()
        initial_count = int(initial_count_text)
        print(f"Initial monopole count in volume: {initial_count}")
        assert initial_count > 10

        await page.screenshot(path="jules-scratch/verification/pre_inflation.png")
        print("Pre-inflation screenshot saved.")

        # 2. Run inflation
        print("Initiating inflation...")
        await page.get_by_role("button", name="Initiate Inflation").click()

        # FIX: Use a simple, long timeout to ensure animation finishes
        print("Waiting for inflation to complete...")
        await page.wait_for_timeout(5000)
        print("Inflation animation should be complete.")

        # 3. Assert final state
        final_count_text = await page.locator("#monopole-count").text_content()
        final_count = int(final_count_text)
        print(f"Final monopole count in volume: {final_count}")

        if final_count > 1:
            raise Exception(f"Inflation failed to solve the monopole problem! Final count: {final_count}")

        print("Monopole count successfully reduced.")

        await page.screenshot(path="jules-scratch/verification/post_inflation.png")
        print("Post-inflation screenshot saved.")

        await browser.close()
        print("Verification script finished successfully.")

if __name__ == "__main__":
    asyncio.run(main())

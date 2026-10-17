import { expect, test } from "@playwright/test";

test.describe("governance vote casting flow", () => {
  test("connects a wallet, opens a proposal, casts a vote, and sees the tally update", async ({ page }) => {
    test.slow();

    const walletAddress = "GABC1234567890ABCDEF1234567890ABCDEF1234567890";

    await page.addInitScript((address) => {
      localStorage.setItem(`iln_onboarding_completed_${address}`, "true");

      const mockRequestHandler = (event: MessageEvent) => {
        const payload = event.data;
        if (!payload || payload.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

        const response: Record<string, unknown> = {
          source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
          messagedId: payload.messageId,
        };

        switch (payload.type) {
          case "REQUEST_CONNECTION_STATUS":
            Object.assign(response, { isConnected: true });
            break;
          case "REQUEST_ALLOWED_STATUS":
            Object.assign(response, { isAllowed: true });
            break;
          case "REQUEST_PUBLIC_KEY":
            Object.assign(response, { publicKey: address });
            break;
          case "REQUEST_NETWORK":
            Object.assign(response, { network: "TESTNET", networkPassphrase: "Test SDF Network ; September 2015" });
            break;
          case "REQUEST_NETWORK_DETAILS":
            Object.assign(response, {
              networkDetails: {
                network: "TESTNET",
                networkName: "Testnet",
                networkUrl: "https://soroban-testnet.stellar.org",
                networkPassphrase: "Test SDF Network ; September 2015",
              },
            });
            break;
          case "SET_ALLOWED_STATUS":
            Object.assign(response, { isAllowed: true });
            break;
          case "SUBMIT_TRANSACTION":
            Object.assign(response, {
              signedTransaction: payload.transactionXdr ?? "AAAA",
              signerAddress: address,
            });
            break;
          default:
            return;
        }

        window.postMessage(response, window.location.origin);
      };

      window.freighter = true;
      window.addEventListener("message", mockRequestHandler);
    }, walletAddress);

    await page.goto("/governance");
    await expect(page.getByRole("heading", { name: "Proposals" })).toBeVisible();

    const proposalLink = page.getByRole("link", { name: /Reduce Base Discount Rate to 3.5%/ }).first();
    await expect(proposalLink).toBeVisible();
    await proposalLink.click();

    await expect(page.getByRole("heading", { name: "Reduce Base Discount Rate to 3.5%" })).toBeVisible();
    await expect(page.getByRole("button", { name: /connect wallet to vote/i })).toBeVisible();

    await page.getByRole("button", { name: /connect wallet to vote/i }).click();
    await expect(page.getByText(/Connected as GABC1.../i)).toBeVisible({ timeout: 20000 });

    const voteButton = page.locator('button:has-text("For")').first();
    await voteButton.click();
    await page.getByRole("button", { name: /Confirm: Vote For/i }).click();

    await expect(page.getByText(/Vote submitted/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/191,050 ILN total/i)).toBeVisible();
  });
});

const { expect }   = require("chai");
const { ethers }   = require("hardhat");
const { time }     = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// ─── Constants ────────────────────────────────────────────────────────────────
// USDC has 6 decimal places: 1 USDC = 1_000_000 base units
const USDC = (amount) => ethers.parseUnits(String(amount), 6);

const GOAL         = USDC(1000); // 1000 USDC default goal
const ONE_USDC     = USDC(1);
const FEE_BPS      = 250n;       // 2.5%
const BPS_DENOM    = 10_000n;
const ONE_DAY      = 86_400;     // seconds

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns a deadline 24 hours from the current on-chain timestamp
async function futureDeadline(secondsFromNow = ONE_DAY) {
    return (await time.latest()) + secondsFromNow;
}

// Calculate expected fee and creator amount for a given total
function calcFee(total) {
    const fee    = (total * FEE_BPS) / BPS_DENOM;
    const amount = total - fee;
    return { fee, amount };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("NexusFund Smart Contracts", function () {
    let factory, mockUSDC;
    let owner, creator, donor1, donor2, feeReceiver, other;

    // Fresh contracts before every test — ensures tests are fully isolated
    beforeEach(async function () {
        [owner, creator, donor1, donor2, feeReceiver, other] = await ethers.getSigners();

        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        mockUSDC = await MockUSDC.deploy();

        const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
        factory = await CampaignFactory.deploy(
            await mockUSDC.getAddress(),
            feeReceiver.address
        );

        // Give each test donor enough USDC to work with
        await mockUSDC.mint(donor1.address, USDC(100_000));
        await mockUSDC.mint(donor2.address, USDC(100_000));
    });

    // ─── Shared helpers (defined after beforeEach so they close over fresh vars) ──

    // Create a campaign via the factory and return the Campaign contract instance
    async function createCampaign({
        _creator  = creator,
        _title    = "Save the Ocean",
        _goal     = GOAL,
        _deadline = null,
    } = {}) {
        const dl = _deadline ?? await futureDeadline();
        const tx = await factory.connect(_creator).createCampaign(_title, _goal, dl);
        const receipt = await tx.wait();

        const event = receipt.logs.find(
            (log) => log.fragment && log.fragment.name === "CampaignCreated"
        );
        const campaignAddress = event.args[0];

        return {
            campaign: await ethers.getContractAt("Campaign", campaignAddress),
            campaignAddress,
            deadline: dl,
        };
    }

    // Approve + donate in one call
    async function donate(campaign, donor, amount) {
        await mockUSDC.connect(donor).approve(await campaign.getAddress(), amount);
        return campaign.connect(donor).donate(amount);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGNFACTORY — DEPLOYMENT
    // ═════════════════════════════════════════════════════════════════════════

    describe("CampaignFactory — deployment", function () {
        it("sets deployer as owner", async function () {
            expect(await factory.owner()).to.equal(owner.address);
        });

        it("stores correct USDC token address", async function () {
            expect(await factory.usdcToken()).to.equal(await mockUSDC.getAddress());
        });

        it("stores correct fee receiver", async function () {
            expect(await factory.feeReceiver()).to.equal(feeReceiver.address);
        });

        it("starts with zero campaigns", async function () {
            expect(await factory.getCampaignCount()).to.equal(0);
        });

        it("reverts with zero USDC address", async function () {
            const Factory = await ethers.getContractFactory("CampaignFactory");
            await expect(
                Factory.deploy(ethers.ZeroAddress, feeReceiver.address)
            ).to.be.revertedWith("Invalid USDC address");
        });

        it("reverts with zero fee receiver", async function () {
            const Factory = await ethers.getContractFactory("CampaignFactory");
            await expect(
                Factory.deploy(await mockUSDC.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid fee receiver");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGNFACTORY — createCampaign
    // ═════════════════════════════════════════════════════════════════════════

    describe("CampaignFactory — createCampaign", function () {
        it("emits CampaignCreated with correct args", async function () {
            const deadline = await futureDeadline();
            await expect(
                factory.connect(creator).createCampaign("Test Campaign", GOAL, deadline)
            )
                .to.emit(factory, "CampaignCreated")
                .withArgs(anyValue, creator.address, "Test Campaign", GOAL, deadline);
        });

        it("increments campaign count after each deployment", async function () {
            expect(await factory.getCampaignCount()).to.equal(0);
            await createCampaign();
            expect(await factory.getCampaignCount()).to.equal(1);
            await createCampaign();
            expect(await factory.getCampaignCount()).to.equal(2);
        });

        it("registers campaign under creator's address", async function () {
            const { campaignAddress } = await createCampaign({ _creator: creator });
            const list = await factory.getCampaignsByCreator(creator.address);
            expect(list).to.include(campaignAddress);
        });

        it("different creators have separate campaign lists", async function () {
            const { campaignAddress: addr1 } = await createCampaign({ _creator: creator });
            const { campaignAddress: addr2 } = await createCampaign({ _creator: other });

            const creatorList = await factory.getCampaignsByCreator(creator.address);
            const otherList   = await factory.getCampaignsByCreator(other.address);

            expect(creatorList).to.include(addr1);
            expect(creatorList).to.not.include(addr2);
            expect(otherList).to.include(addr2);
        });

        it("getAllCampaigns returns all deployed addresses", async function () {
            const { campaignAddress: a1 } = await createCampaign();
            const { campaignAddress: a2 } = await createCampaign();
            const all = await factory.getAllCampaigns();
            expect(all).to.include(a1);
            expect(all).to.include(a2);
        });

        it("reverts when title is empty", async function () {
            const dl = await futureDeadline();
            await expect(
                factory.connect(creator).createCampaign("", GOAL, dl)
            ).to.be.revertedWith("Title cannot be empty");
        });

        it("reverts when title exceeds 200 characters", async function () {
            const dl    = await futureDeadline();
            const title = "A".repeat(201);
            await expect(
                factory.connect(creator).createCampaign(title, GOAL, dl)
            ).to.be.revertedWith("Title too long");
        });

        it("reverts when goal is zero", async function () {
            const dl = await futureDeadline();
            await expect(
                factory.connect(creator).createCampaign("Test", 0, dl)
            ).to.be.revertedWith("Goal must be greater than zero");
        });

        it("reverts when deadline is in the past", async function () {
            const past = (await time.latest()) - 1;
            await expect(
                factory.connect(creator).createCampaign("Test", GOAL, past)
            ).to.be.revertedWith("Deadline must be in the future");
        });

        it("reverts when deadline is current block timestamp", async function () {
            const now = await time.latest();
            await expect(
                factory.connect(creator).createCampaign("Test", GOAL, now)
            ).to.be.revertedWith("Deadline must be in the future");
        });

        it("returns the deployed campaign address", async function () {
            const dl  = await futureDeadline();
            const addr = await factory.connect(creator).createCampaign.staticCall("Test", GOAL, dl);
            expect(addr).to.match(/^0x[0-9a-fA-F]{40}$/);
            expect(addr).to.not.equal(ethers.ZeroAddress);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGNFACTORY — updateFeeReceiver
    // ═════════════════════════════════════════════════════════════════════════

    describe("CampaignFactory — updateFeeReceiver", function () {
        it("owner can update fee receiver", async function () {
            await factory.connect(owner).updateFeeReceiver(other.address);
            expect(await factory.feeReceiver()).to.equal(other.address);
        });

        it("non-owner cannot update fee receiver", async function () {
            await expect(
                factory.connect(creator).updateFeeReceiver(other.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("reverts when new receiver is zero address", async function () {
            await expect(
                factory.connect(owner).updateFeeReceiver(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid address");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGNFACTORY — transferOwnership (inherited from Ownable)
    // ═════════════════════════════════════════════════════════════════════════

    describe("CampaignFactory — transferOwnership", function () {
        it("owner can transfer ownership", async function () {
            await factory.connect(owner).transferOwnership(other.address);
            expect(await factory.owner()).to.equal(other.address);
        });

        it("non-owner cannot transfer ownership", async function () {
            await expect(
                factory.connect(creator).transferOwnership(other.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGN — initial state (after deployment via factory)
    // ═════════════════════════════════════════════════════════════════════════

    describe("Campaign — initial state", function () {
        it("stores correct creator, title, goal, deadline", async function () {
            const deadline = await futureDeadline();
            const { campaign } = await createCampaign({
                _creator: creator, _title: "Clean Water Fund", _goal: GOAL, _deadline: deadline,
            });

            expect(await campaign.creator()).to.equal(creator.address);
            expect(await campaign.title()).to.equal("Clean Water Fund");
            expect(await campaign.goalAmount()).to.equal(GOAL);
            expect(await campaign.deadline()).to.equal(deadline);
        });

        it("stores the factory's feeReceiver at time of deployment", async function () {
            const { campaign } = await createCampaign();
            expect(await campaign.feeReceiver()).to.equal(feeReceiver.address);
        });

        it("starts with totalRaised = 0 and donorCount = 0", async function () {
            const { campaign } = await createCampaign();
            expect(await campaign.totalRaised()).to.equal(0);
            expect(await campaign.donorCount()).to.equal(0);
        });

        it("isActive() returns true before deadline", async function () {
            const { campaign } = await createCampaign();
            expect(await campaign.isActive()).to.be.true;
        });

        it("isGoalMet() returns false before any donations", async function () {
            const { campaign } = await createCampaign();
            expect(await campaign.isGoalMet()).to.be.false;
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGN — donate
    // ═════════════════════════════════════════════════════════════════════════

    describe("Campaign — donate", function () {
        it("updates totalRaised and donations mapping correctly", async function () {
            const { campaign }     = await createCampaign();
            const donationAmount   = USDC(250);

            await donate(campaign, donor1, donationAmount);

            expect(await campaign.totalRaised()).to.equal(donationAmount);
            expect(await campaign.donations(donor1.address)).to.equal(donationAmount);
        });

        it("transfers USDC from donor into the campaign contract", async function () {
            const { campaign, campaignAddress } = await createCampaign();
            const donationAmount                = USDC(100);

            const donorBefore    = await mockUSDC.balanceOf(donor1.address);
            const contractBefore = await mockUSDC.balanceOf(campaignAddress);

            await donate(campaign, donor1, donationAmount);

            expect(await mockUSDC.balanceOf(donor1.address)).to.equal(donorBefore - donationAmount);
            expect(await mockUSDC.balanceOf(campaignAddress)).to.equal(contractBefore + donationAmount);
        });

        it("emits DonationReceived with donor, amount, and running total", async function () {
            const { campaign } = await createCampaign();
            const amount       = USDC(150);

            await mockUSDC.connect(donor1).approve(await campaign.getAddress(), amount);
            await expect(campaign.connect(donor1).donate(amount))
                .to.emit(campaign, "DonationReceived")
                .withArgs(donor1.address, amount, amount); // totalRaised equals amount on first donation
        });

        it("increments donorCount only once per unique donor", async function () {
            const { campaign } = await createCampaign();

            await donate(campaign, donor1, ONE_USDC);
            await donate(campaign, donor1, ONE_USDC); // second donation from same donor

            expect(await campaign.donorCount()).to.equal(1);
            expect(await campaign.donations(donor1.address)).to.equal(ONE_USDC * 2n);
        });

        it("counts each distinct donor separately", async function () {
            const { campaign } = await createCampaign();

            await donate(campaign, donor1, ONE_USDC);
            await donate(campaign, donor2, ONE_USDC);

            expect(await campaign.donorCount()).to.equal(2);
        });

        it("allows donations up to and beyond the goal (overfunding)", async function () {
            const { campaign } = await createCampaign();

            await donate(campaign, donor1, GOAL);
            await donate(campaign, donor2, USDC(500)); // over goal

            expect(await campaign.totalRaised()).to.equal(GOAL + USDC(500));
        });

        it("reverts when called after the deadline", async function () {
            const { campaign, deadline } = await createCampaign();
            await time.increaseTo(deadline + 1);

            await mockUSDC.connect(donor1).approve(await campaign.getAddress(), ONE_USDC);
            await expect(campaign.connect(donor1).donate(ONE_USDC))
                .to.be.revertedWith("Campaign has ended");
        });

        it("reverts when donation amount is zero", async function () {
            const { campaign } = await createCampaign();
            await expect(campaign.connect(donor1).donate(0))
                .to.be.revertedWith("Donation must be greater than zero");
        });

        it("reverts when donor has not approved USDC spending", async function () {
            const { campaign } = await createCampaign();
            // No approve() call — transferFrom will fail
            await expect(campaign.connect(donor1).donate(ONE_USDC))
                .to.be.reverted;
        });

        it("reverts when donor approves less than donation amount", async function () {
            const { campaign } = await createCampaign();
            await mockUSDC.connect(donor1).approve(await campaign.getAddress(), ONE_USDC - 1n);
            await expect(campaign.connect(donor1).donate(ONE_USDC))
                .to.be.reverted;
        });

        it("rejects direct ETH transfers", async function () {
            const { campaignAddress } = await createCampaign();
            await expect(
                donor1.sendTransaction({ to: campaignAddress, value: ethers.parseEther("1") })
            ).to.be.reverted;
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGN — withdraw
    // ═════════════════════════════════════════════════════════════════════════

    describe("Campaign — withdraw", function () {
        it("sends correct amounts to creator and feeReceiver after successful campaign", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            await time.increaseTo(deadline + 1);

            const { fee, amount: creatorExpected } = calcFee(GOAL);

            const creatorBefore      = await mockUSDC.balanceOf(creator.address);
            const feeReceiverBefore  = await mockUSDC.balanceOf(feeReceiver.address);

            await campaign.connect(creator).withdraw();

            expect(await mockUSDC.balanceOf(creator.address)).to.equal(creatorBefore + creatorExpected);
            expect(await mockUSDC.balanceOf(feeReceiver.address)).to.equal(feeReceiverBefore + fee);
        });

        it("calculates exactly 2.5% platform fee on 1000 USDC", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, USDC(1000));
            await time.increaseTo(deadline + 1);

            await expect(campaign.connect(creator).withdraw())
                .to.emit(campaign, "FundsWithdrawn")
                .withArgs(creator.address, USDC(975), USDC(25)); // 97.5% + 2.5%
        });

        it("drains the campaign contract to zero after withdrawal", async function () {
            const { campaign, campaignAddress, deadline } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            await time.increaseTo(deadline + 1);
            await campaign.connect(creator).withdraw();

            expect(await mockUSDC.balanceOf(campaignAddress)).to.equal(0);
        });

        it("emits FundsWithdrawn event", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            await time.increaseTo(deadline + 1);

            await expect(campaign.connect(creator).withdraw())
                .to.emit(campaign, "FundsWithdrawn");
        });

        it("sets withdrawn flag to true", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            await time.increaseTo(deadline + 1);
            await campaign.connect(creator).withdraw();

            expect(await campaign.withdrawn()).to.be.true;
        });

        it("reverts when called before the deadline", async function () {
            const { campaign } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            // Deadline has NOT passed yet

            await expect(campaign.connect(creator).withdraw())
                .to.be.revertedWith("Cannot withdraw before deadline");
        });

        it("reverts when funding goal was not met", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, USDC(999)); // 1 USDC short
            await time.increaseTo(deadline + 1);

            await expect(campaign.connect(creator).withdraw())
                .to.be.revertedWith("Funding goal was not met");
        });

        it("reverts when called by someone who is not the creator", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            await time.increaseTo(deadline + 1);

            await expect(campaign.connect(donor1).withdraw())
                .to.be.revertedWith("Only the campaign creator can withdraw");
        });

        it("reverts on a second withdraw attempt (double-withdraw blocked)", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            await time.increaseTo(deadline + 1);

            await campaign.connect(creator).withdraw();

            await expect(campaign.connect(creator).withdraw())
                .to.be.revertedWith("Funds have already been withdrawn");
        });

        it("works correctly when goal is exceeded (overfunded)", async function () {
            const { campaign, deadline } = await createCampaign();
            const total = USDC(1500); // 500 more than goal
            await donate(campaign, donor1, total);
            await time.increaseTo(deadline + 1);

            const { fee, amount: creatorExpected } = calcFee(total);

            const creatorBefore = await mockUSDC.balanceOf(creator.address);
            await campaign.connect(creator).withdraw();

            expect(await mockUSDC.balanceOf(creator.address)).to.equal(creatorBefore + creatorExpected);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGN — refund
    // ═════════════════════════════════════════════════════════════════════════

    describe("Campaign — refund", function () {
        it("returns the exact donated amount to each donor", async function () {
            const { campaign, deadline } = await createCampaign();
            const donation = USDC(400); // goal is 1000, so campaign fails
            await donate(campaign, donor1, donation);
            await time.increaseTo(deadline + 1);

            const before = await mockUSDC.balanceOf(donor1.address);
            await campaign.connect(donor1).refund();

            expect(await mockUSDC.balanceOf(donor1.address)).to.equal(before + donation);
        });

        it("emits RefundIssued with donor address and amount", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, USDC(200));
            await time.increaseTo(deadline + 1);

            await expect(campaign.connect(donor1).refund())
                .to.emit(campaign, "RefundIssued")
                .withArgs(donor1.address, USDC(200));
        });

        it("zeroes out donor's balance after refund", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, USDC(300));
            await time.increaseTo(deadline + 1);
            await campaign.connect(donor1).refund();

            expect(await campaign.donations(donor1.address)).to.equal(0);
        });

        it("blocks double refund — same address cannot drain the contract", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, USDC(300));
            await time.increaseTo(deadline + 1);

            await campaign.connect(donor1).refund();

            await expect(campaign.connect(donor1).refund())
                .to.be.revertedWith("You have no donation to refund");
        });

        it("allows multiple distinct donors to each refund independently", async function () {
            const { campaign, campaignAddress, deadline } = await createCampaign();
            const amount1 = USDC(300);
            const amount2 = USDC(200);

            await donate(campaign, donor1, amount1);
            await donate(campaign, donor2, amount2);
            await time.increaseTo(deadline + 1);

            const d1Before = await mockUSDC.balanceOf(donor1.address);
            const d2Before = await mockUSDC.balanceOf(donor2.address);

            await campaign.connect(donor1).refund();
            await campaign.connect(donor2).refund();

            expect(await mockUSDC.balanceOf(donor1.address)).to.equal(d1Before + amount1);
            expect(await mockUSDC.balanceOf(donor2.address)).to.equal(d2Before + amount2);
            expect(await mockUSDC.balanceOf(campaignAddress)).to.equal(0); // fully drained
        });

        it("reverts when called before the deadline", async function () {
            const { campaign } = await createCampaign();
            await donate(campaign, donor1, ONE_USDC);
            // Deadline has NOT passed

            await expect(campaign.connect(donor1).refund())
                .to.be.revertedWith("Campaign is still active");
        });

        it("reverts when the campaign succeeded (goal was met)", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, GOAL); // full goal met
            await time.increaseTo(deadline + 1);

            await expect(campaign.connect(donor1).refund())
                .to.be.revertedWith("Campaign succeeded, no refunds");
        });

        it("reverts when the caller made no donation", async function () {
            const { campaign, deadline } = await createCampaign();
            await donate(campaign, donor1, USDC(100));
            await time.increaseTo(deadline + 1);

            // donor2 never donated but tries to refund
            await expect(campaign.connect(donor2).refund())
                .to.be.revertedWith("You have no donation to refund");
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // CAMPAIGN — view functions
    // ═════════════════════════════════════════════════════════════════════════

    describe("Campaign — view functions", function () {
        it("isActive() returns false after deadline passes", async function () {
            const { campaign, deadline } = await createCampaign();
            await time.increaseTo(deadline + 1);
            expect(await campaign.isActive()).to.be.false;
        });

        it("isGoalMet() returns false when below goal", async function () {
            const { campaign } = await createCampaign();
            await donate(campaign, donor1, USDC(999));
            expect(await campaign.isGoalMet()).to.be.false;
        });

        it("isGoalMet() returns true when exactly at goal", async function () {
            const { campaign } = await createCampaign();
            await donate(campaign, donor1, GOAL);
            expect(await campaign.isGoalMet()).to.be.true;
        });

        it("isGoalMet() returns true when above goal", async function () {
            const { campaign } = await createCampaign();
            await donate(campaign, donor1, GOAL + ONE_USDC);
            expect(await campaign.isGoalMet()).to.be.true;
        });

        it("timeRemaining() returns 0 after deadline", async function () {
            const { campaign, deadline } = await createCampaign();
            await time.increaseTo(deadline + 1);
            expect(await campaign.timeRemaining()).to.equal(0);
        });

        it("timeRemaining() returns a positive number before deadline", async function () {
            const { campaign } = await createCampaign();
            const remaining = await campaign.timeRemaining();
            expect(remaining).to.be.gt(0);
        });
    });

    // ═════════════════════════════════════════════════════════════════════════
    // FEE RECEIVER SNAPSHOT
    // ═════════════════════════════════════════════════════════════════════════

    describe("Fee receiver snapshot behaviour", function () {
        it("campaign uses feeReceiver at creation time, not the updated one", async function () {
            // Deploy campaign with original feeReceiver
            const { campaign, deadline } = await createCampaign();

            // Owner updates feeReceiver in factory AFTER campaign was created
            await factory.connect(owner).updateFeeReceiver(other.address);

            await donate(campaign, donor1, GOAL);
            await time.increaseTo(deadline + 1);

            const originalFeeReceiverBefore = await mockUSDC.balanceOf(feeReceiver.address);
            const newFeeReceiverBefore      = await mockUSDC.balanceOf(other.address);

            await campaign.connect(creator).withdraw();

            // Old feeReceiver received the fee (campaign was created before the update)
            expect(await mockUSDC.balanceOf(feeReceiver.address)).to.be.gt(originalFeeReceiverBefore);
            // New feeReceiver received nothing from this old campaign
            expect(await mockUSDC.balanceOf(other.address)).to.equal(newFeeReceiverBefore);
        });
    });
});

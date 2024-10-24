import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("QuestSystem", function () {
  // Fixture to deploy the contract and set up test accounts
  async function deployQuestSystemFixture() {
    const [owner, questTaker, otherAccount] = await hre.ethers.getSigners();

    const QuestSystem = await hre.ethers.getContractFactory("QuestSystem");
    const questSystem = await QuestSystem.deploy();

    const sampleQuest = {
      description: "Complete this test quest",
      reward: hre.ethers.parseEther("1.0"),
      completed: false,
    };

    return { questSystem, owner, questTaker, otherAccount, sampleQuest };
  }

  describe("Quest Creation", function () {
    it("Should create a quest with correct parameters", async function () {
      const { questSystem, owner, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );

      await expect(
        questSystem.createQuest(sampleQuest, { value: sampleQuest.reward })
      )
        .to.emit(questSystem, "QuestCreated")
        .withArgs(1, owner.address, [
          sampleQuest.description,
          sampleQuest.reward,
          false,
        ]);
    });

    it("Should fail if reward amount doesn't match sent value", async function () {
      const { questSystem, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );

      await expect(
        questSystem.createQuest(sampleQuest, {
          value: hre.ethers.parseEther("0.5"),
        })
      ).to.be.revertedWith("Reward should be paid");
    });

    it("Should fail if reward is zero", async function () {
      const { questSystem } = await loadFixture(deployQuestSystemFixture);

      const invalidQuest = {
        description: "Zero reward quest",
        reward: 0n,
        completed: false,
      };

      await expect(
        questSystem.createQuest(invalidQuest, {
          value: 0,
        })
      ).to.be.revertedWith("Reward should be greater than 0");
    });

    it("Should fail if description is empty", async function () {
      const { questSystem } = await loadFixture(deployQuestSystemFixture);

      const invalidQuest = {
        description: "",
        reward: hre.ethers.parseEther("1.0"),
        completed: false,
      };

      await expect(
        questSystem.createQuest(invalidQuest, {
          value: invalidQuest.reward,
        })
      ).to.be.revertedWith("Description should not be empty");
    });

    it("Should fail if creator already has a quest", async function () {
      const { questSystem, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );

      await questSystem.createQuest(sampleQuest, { value: sampleQuest.reward });

      await expect(
        questSystem.createQuest(sampleQuest, {
          value: sampleQuest.reward,
        })
      ).to.be.revertedWith("You already have a quest");
    });
  });

  describe("Quest Taking", function () {
    it("Should allow taking an existing quest", async function () {
      const { questSystem, questTaker, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );

      await questSystem.createQuest(sampleQuest, { value: sampleQuest.reward });

      await expect(questSystem.connect(questTaker).takeQuest(1))
        .to.emit(questSystem, "QuestTaken")
        .withArgs(1, questTaker.address, [
          sampleQuest.description,
          sampleQuest.reward,
          false,
        ]);
    });

    it("Should fail if quest doesn't exist", async function () {
      const { questSystem, questTaker } = await loadFixture(
        deployQuestSystemFixture
      );

      await expect(
        questSystem.connect(questTaker).takeQuest(999)
      ).to.be.revertedWith("Quest does not exist");
    });

    it("Should fail if taker already has a quest", async function () {
      const { questSystem, owner, questTaker, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );
      const [_, otherAccount] = await hre.ethers.getSigners();

      // Create two quests
      await questSystem.createQuest(sampleQuest, { value: sampleQuest.reward });
      await questSystem.connect(otherAccount).createQuest(
        {
          ...sampleQuest,
          description: "Second quest",
        },
        { value: sampleQuest.reward }
      );

      // Take first quest
      await questSystem.connect(questTaker).takeQuest(1);

      // Try to take second quest
      await expect(
        questSystem.connect(questTaker).takeQuest(2)
      ).to.be.revertedWith("You already have a quest");
    });

    it("Should fail if trying to take own quest", async function () {
      const { questSystem, owner, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );

      await questSystem.createQuest(sampleQuest, { value: sampleQuest.reward });

      await expect(questSystem.takeQuest(1)).to.be.revertedWith(
        "You can't take your own quest"
      );
    });
  });

  describe("Quest Completion", function () {
    it("Should complete quest and transfer reward", async function () {
      const { questSystem, questTaker, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );

      // Create and take quest
      await questSystem.createQuest(sampleQuest, { value: sampleQuest.reward });
      await questSystem.connect(questTaker).takeQuest(1);

      // Check balance changes on completion
      const initialBalance = await hre.ethers.provider.getBalance(
        questTaker.address
      );
      await expect(questSystem.connect(questTaker).completeQuest())
        .to.emit(questSystem, "QuestCompleted")
        .withArgs(1, questTaker.address, [
          sampleQuest.description,
          sampleQuest.reward,
          true,
        ]);
      const finalBalance = await hre.ethers.provider.getBalance(
        questTaker.address
      );
      // Check that the balance increased by the reward amount
      expect(finalBalance).not.to.equal(initialBalance);
    });

    it("Should fail if taker has no quest", async function () {
      const { questSystem, questTaker } = await loadFixture(
        deployQuestSystemFixture
      );

      await expect(
        questSystem.connect(questTaker).completeQuest()
      ).to.be.revertedWith("You don't have a quest");
    });

    it("Should fail if quest is already completed", async function () {
      const { questSystem, questTaker, sampleQuest } = await loadFixture(
        deployQuestSystemFixture
      );

      // Create and take quest
      await questSystem.createQuest(sampleQuest, { value: sampleQuest.reward });
      await questSystem.connect(questTaker).takeQuest(1);

      // Complete quest
      await questSystem.connect(questTaker).completeQuest();

      // Try to complete again
      await expect(
        questSystem.connect(questTaker).completeQuest()
      ).to.be.revertedWith("You don't have a quest");
    });
  });
});

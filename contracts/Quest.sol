// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

contract QuestSystem {
    struct Quest {
        string description;
        uint reward;
        bool completed;
    }

    event QuestCreated(uint256 id, address indexed creator, Quest quest);
    event QuestTaken(uint256 id, address indexed taker, Quest quest);
    event QuestCompleted(uint256 id, address indexed completer, Quest quest);

    // maps the address of the creator to the quest
    mapping(address => Quest) private quests;
    // maps the address of the taker to the quest id
    mapping(address => uint256) private questTaken;
    // maps the quest id to the quest
    mapping(uint256 => Quest) private questList;
    // maps the quest id to the creator
    mapping(uint256 => address) private questCreators;
    // maps creator to quest id in order to check if the creator has a quest
    mapping(address => uint256) private creatorQuest;
    uint256 id = 1;

    /**
     * Each quest created should also pay the same amount of ether as the reward
     * @param quest The quest to be created
     */
    function createQuest(Quest memory quest) public payable {
        require(quest.reward == msg.value, "Reward should be paid");
        require(quest.reward > 0, "Reward should be greater than 0");
        require(
            bytes(quest.description).length > 0,
            "Description should not be empty"
        );
        require(creatorQuest[msg.sender] == 0, "You already have a quest");

        // Quest created
        // store the quest in the quest list
        questList[id] = quest;
        // store the sender's quest
        quests[msg.sender] = quest;
        questCreators[id] = msg.sender;
        creatorQuest[msg.sender] = id;
        emit QuestCreated(id, msg.sender, quest);
        id++;
    }

    function takeQuest(uint questId) public {
        require(questList[questId].reward > 0, "Quest does not exist");
        require(questTaken[msg.sender] == 0, "You already have a quest");
        require(
            questCreators[questId] != msg.sender,
            "You can't take your own quest"
        );

        questTaken[msg.sender] = questId;
        emit QuestTaken(questId, msg.sender, questList[questId]);
    }

    function completeQuest() public {
        uint questId = questTaken[msg.sender];
        require(questId > 0, "You don't have a quest");

        Quest memory quest = questList[questId];
        require(quest.reward > 0, "Quest does not exist");
        require(!quest.completed, "Quest already completed");

        // Update all state variables first
        quest.completed = true;
        questList[questId] = quest;
        questTaken[msg.sender] = 0;
        creatorQuest[questCreators[questId]] = 0;

        // Transfer funds last
        (bool success, ) = payable(msg.sender).call{value: quest.reward}("");
        require(success, "Transfer failed");

        emit QuestCompleted(questId, msg.sender, quest);
    }
}

/**
 * CYBERQUEST ARENA - CORE COMBAT ENGINE (ES6+ State-Driven Architecture)
 */

// 1. Dữ liệu dự phòng (Dùng khi mở trực tiếp file:// không qua Live Server)
const FALLBACK_DATA = {
    stages: [
        {
            stage: 1,
            title: "Tầng 1: Cổng Ngục Tối",
            boss: { name: "Shadow Golem", avatar: "👾", maxHp: 150, atk: 20, shield: 5, rewardGold: 45 }
        },
        {
            stage: 2,
            title: "Tầng 2: Lò Phản Ứng Ngầm",
            boss: { name: "Cyber Drake", avatar: "🐉", maxHp: 210, atk: 28, shield: 10, rewardGold: 70 }
        },
        {
            stage: 3,
            title: "Tầng 3: Ngai Vàng Hư Không",
            boss: { name: "Void Overlord", avatar: "👹", maxHp: 300, atk: 35, shield: 15, rewardGold: 150 }
        }
    ],
    initialInventory: [
        { id: "hp_potion", name: "🧪 Bình Máu Nhỏ (+40 HP)", qty: 2, type: "heal", value: 40 },
        { id: "mp_battery", name: "🔋 Pin Năng Lượng (+30 MP)", qty: 1, type: "mana", value: 30 }
    ]
};

// 2. Bảng thông số Kỹ năng (Dictionary Lookup)
const SKILLS = {
    strike: { name: "⚔️ Trảm Kích", cost: 0, dmg: 25, ignoreShield: false, shieldGain: 0, heal: 0 },
    plasma: { name: "⚡ Pháo Plasma", cost: 20, dmg: 45, ignoreShield: true, shieldGain: 0, heal: 0 },
    shield: { name: "🛡️ Khiên Từ Trường", cost: 15, dmg: 0, ignoreShield: false, shieldGain: 20, heal: 0 },
    heal: { name: "💚 Tái Tạo Nano", cost: 25, dmg: 0, ignoreShield: false, shieldGain: 0, heal: 35 }
};

// 3. SINGLE SOURCE OF TRUTH: Trạng thái toàn cục của trò chơi
const gameState = {
    stageIndex: 0,
    gold: 120,
    turn: "PLAYER", // 'PLAYER' | 'BOSS' | 'VICTORY' | 'DEFEAT'
    timeLeft: 15,
    timerId: null,
    hero: {
        name: "Cyber Knight",
        level: 1,
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        atk: 25,
        shield: 10
    },
    boss: {
        name: "Shadow Golem",
        avatar: "👾",
        hp: 150,
        maxHp: 150,
        atk: 20,
        shield: 5,
        rewardGold: 45
    },
    stages: [],
    inventory: [],
    logs: []
};

// 4. Truy xuất các phần tử DOM (Caching DOM Elements)
const dom = {
    stageNumber: document.getElementById("stage-number"),
    playerGold: document.getElementById("player-gold"),
    btnShop: document.getElementById("btn-shop"),
    heroName: document.getElementById("hero-name"),
    heroLevel: document.getElementById("hero-level"),
    heroHpText: document.getElementById("hero-hp-text"),
    heroHpBar: document.getElementById("hero-hp-bar"),
    heroMpText: document.getElementById("hero-mp-text"),
    heroMpBar: document.getElementById("hero-mp-bar"),
    heroShield: document.getElementById("hero-shield"),
    heroAtk: document.getElementById("hero-atk"),
    turnStatus: document.getElementById("turn-status"),
    turnTimer: document.getElementById("turn-timer"),
    bossName: document.getElementById("boss-name"),
    bossAvatar: document.querySelector(".boss-avatar"),
    bossIntent: document.getElementById("boss-intent"),
    bossHpText: document.getElementById("boss-hp-text"),
    bossHpBar: document.getElementById("boss-hp-bar"),
    bossShield: document.getElementById("boss-shield"),
    bossReward: document.getElementById("boss-reward"),
    skillDeck: document.getElementById("skill-deck"),
    btnEndTurn: document.getElementById("btn-end-turn"),
    inventoryList: document.getElementById("inventory-list"),
    combatLog: document.getElementById("combat-log")
};

// 5. ASYNC/AWAIT & FETCH API: Tải dữ liệu Quái vật và Khởi tạo Ải
async function initGame() {
    try {
        const response = await fetch("./data/game-data.json");
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        gameState.stages = data.stages;
        gameState.inventory = data.initialInventory.map(item => ({ ...item }));
        addLog("system", "Đã tải dữ liệu ải từ máy chủ JSON thành công!");
    } catch (error) {
        // Dự phòng nếu mở trực tiếp file index.html mà không dùng Live Server
        gameState.stages = FALLBACK_DATA.stages;
        gameState.inventory = FALLBACK_DATA.initialInventory.map(item => ({ ...item }));
        addLog("system", "Chế độ Offline: Đã nạp dữ liệu mặc định.");
    }

    // Khôi phục Vàng từ LocalStorage nếu có
    const savedGold = localStorage.getItem("cq_gold");
    if (savedGold !== null) {
        gameState.gold = Number(savedGold);
    }

    loadStage(0);
}

// Thiết lập thông số Quái vật theo tầng
function loadStage(index) {
    const currentStage = gameState.stages[index];
    if (!currentStage) return;

    gameState.stageIndex = index;
    gameState.boss = {
        ...currentStage.boss,
        hp: currentStage.boss.maxHp
    };
    gameState.turn = "PLAYER";

    addLog("system", `Bước vào ${currentStage.title} — Đối đầu ${gameState.boss.name}!`);
    renderUI();
    startTurnTimer();
}

// 6. EVENT LOOP & TIMERS: Bộ đếm ngược 15 giây mỗi lượt
function startTurnTimer() {
    clearInterval(gameState.timerId);
    gameState.timeLeft = 15;
    renderUI();

    gameState.timerId = setInterval(() => {
        if (gameState.turn !== "PLAYER") {
            clearInterval(gameState.timerId);
            return;
        }

        gameState.timeLeft -= 1;
        dom.turnTimer.textContent = `${gameState.timeLeft}s`;

        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timerId);
            addLog("system", "⏰ Hết thời gian suy nghĩ! Tự động chuyển lượt.");
            triggerBossTurn();
        }
    }, 1000);
}

// 7. LOGIC CHIẾN ĐẤU CỦA NGƯỜI CHƠI (PLAYER TURN)
function handleSkillUse(skillId) {
    if (gameState.turn !== "PLAYER") return;

    const skill = SKILLS[skillId];
    if (!skill) return;

    const { hero, boss } = gameState;

    // Kiểm tra đủ năng lượng (MP) không
    if (hero.mp < skill.cost) {
        addLog("system", `❗ Không đủ MP để dùng ${skill.name} (Cần ${skill.cost} MP)!`);
        return;
    }

    // Trừ MP
    hero.mp -= skill.cost;

    // Xử lý sát thương lên Boss
    if (skill.dmg > 0) {
        let actualDmg = skill.dmg;
        if (!skill.ignoreShield && boss.shield > 0) {
            const blocked = Math.min(boss.shield, actualDmg);
            boss.shield -= blocked;
            actualDmg -= blocked;
        }
        boss.hp = Math.max(0, boss.hp - actualDmg);
        addLog("player", `Bạn tung chiêu ${skill.name}, gây ${actualDmg} sát thương lên ${boss.name}!`);
    }

    // Xử lý tăng giáp
    if (skill.shieldGain > 0) {
        hero.shield += skill.shieldGain;
        addLog("player", `Bạn kích hoạt ${skill.name}, nhận thêm +${skill.shieldGain} Giáp.`);
    }

    // Xử lý hồi máu
    if (skill.heal > 0) {
        const prevHp = hero.hp;
        hero.hp = Math.min(hero.maxHp, hero.hp + skill.heal);
        addLog("player", `Bạn dùng ${skill.name}, hồi phục +${hero.hp - prevHp} HP.`);
    }

    // Kiểm tra xem Boss đã bị hạ gục chưa
    if (boss.hp <= 0) {
        handleStageVictory();
        return;
    }

    // Kết thúc lượt người chơi -> Chuyển sang lượt Boss
    triggerBossTurn();
}

// Bỏ lượt để hồi năng lượng
function handleEndTurn() {
    if (gameState.turn !== "PLAYER") return;
    const mpRecovered = 15;
    gameState.hero.mp = Math.min(gameState.hero.maxMp, gameState.hero.mp + mpRecovered);
    addLog("player", `Bạn chủ động kết thúc lượt và tụ khí hồi phục +${mpRecovered} MP.`);
    triggerBossTurn();
}

// Sử dụng vật phẩm trong túi đồ (Không mất lượt đấu)
function handleUseItem(itemId) {
    if (gameState.turn !== "PLAYER") return;

    const item = gameState.inventory.find(i => i.id === itemId);
    if (!item || item.qty <= 0) return;

    const { hero } = gameState;
    item.qty -= 1;

    if (item.type === "heal") {
        hero.hp = Math.min(hero.maxHp, hero.hp + item.value);
        addLog("player", `Sử dụng ${item.name}! Máu hiện tại: ${hero.hp}/${hero.maxHp}.`);
    } else if (item.type === "mana") {
        hero.mp = Math.min(hero.maxMp, hero.mp + item.value);
        addLog("player", `Sử dụng ${item.name}! Năng lượng hiện tại: ${hero.mp}/${hero.maxMp}.`);
    }

    renderUI();
}

// Mua nhanh Bình máu tại Cửa hàng (30 Vàng)
function handleQuickShop() {
    const POTION_PRICE = 30;
    if (gameState.gold < POTION_PRICE) {
        addLog("system", `🛒 Không đủ Vàng! Cần ${POTION_PRICE} Vàng để mua Bình Máu Nhỏ.`);
        return;
    }

    gameState.gold -= POTION_PRICE;
    localStorage.setItem("cq_gold", gameState.gold);

    const potion = gameState.inventory.find(i => i.id === "hp_potion");
    if (potion) {
        potion.qty += 1;
    }
    addLog("system", `🛒 Đã mua 1 Bình Máu Nhỏ (-${POTION_PRICE} Vàng).`);
    renderUI();
}

// 8. LOGIC PHẢN ĐÒN CỦA QUÁI VẬT (BOSS AI TURN)
function triggerBossTurn() {
    clearInterval(gameState.timerId);
    gameState.turn = "BOSS";
    renderUI();

    // Dùng setTimeout tạo độ trễ 900ms để người chơi quan sát đòn đánh của Boss
    setTimeout(() => {
        const { hero, boss } = gameState;
        let incomingDmg = boss.atk;

        // Giáp của Hero chặn sát thương trước
        if (hero.shield > 0) {
            const absorbed = Math.min(hero.shield, incomingDmg);
            hero.shield -= absorbed;
            incomingDmg -= absorbed;
        }

        hero.hp = Math.max(0, hero.hp - incomingDmg);
        addLog("boss", `${boss.name} tung đòn tấn công! Bạn mất ${incomingDmg} HP.`);

        // Kiểm tra nếu Hero hết máu
        if (hero.hp <= 0) {
            gameState.turn = "DEFEAT";
            addLog("system", "💀 BẠN ĐÃ GỤC NGÃ! Đang hồi sinh lại tại đầu tầng sau 3 giây...");
            renderUI();

            setTimeout(() => {
                hero.hp = hero.maxHp;
                hero.mp = hero.maxMp;
                hero.shield = 10;
                loadStage(gameState.stageIndex);
            }, 3000);
            return;
        }

        // Hồi nhẹ 5 MP mỗi đầu lượt mới và trả lại lượt cho Người chơi
        hero.mp = Math.min(hero.maxMp, hero.mp + 5);
        gameState.turn = "PLAYER";
        renderUI();
        startTurnTimer();
    }, 900);
}

// 9. XỬ LÝ CHIẾN THẮNG & QUA TẦNG TIẾP THEO
function handleStageVictory() {
    clearInterval(gameState.timerId);
    gameState.turn = "VICTORY";

    const reward = gameState.boss.rewardGold;
    gameState.gold += reward;
    gameState.hero.level += 1;
    gameState.hero.maxHp += 15;
    gameState.hero.hp = Math.min(gameState.hero.maxHp, gameState.hero.hp + 30);
    localStorage.setItem("cq_gold", gameState.gold);

    addLog("system", `🎉 CHIẾN THẮNG! Hạ gục ${gameState.boss.name}, nhận +${reward} Vàng & lên Cấp ${gameState.hero.level}!`);
    renderUI();

    setTimeout(() => {
        const nextIndex = (gameState.stageIndex + 1) % gameState.stages.length;
        loadStage(nextIndex);
    }, 2200);
}

// 10. GHI NHẬT KÝ TRẬN ĐẤU (COMBAT LOG)
function addLog(type, message) {
    gameState.logs.unshift({ type, message });
    if (gameState.logs.length > 20) {
        gameState.logs.pop();
    }
    renderLogs();
}

function renderLogs() {
    dom.combatLog.innerHTML = gameState.logs
        .map(log => {
            const cssClass = log.type === "boss" ? "boss-log" : "system-log";
            return `<li class="log-entry ${cssClass}">${log.message}</li>`;
        })
        .join("");
}

// 11. HÀM RENDER UI: Đồng bộ toàn bộ State ra Giao diện HTML
function renderUI() {
    const { hero, boss, gold, turn, timeLeft, stages, stageIndex, inventory } = gameState;
    const currentStageInfo = stages[stageIndex];

    // Cập nhật Header
    if (currentStageInfo) {
        dom.stageNumber.textContent = currentStageInfo.title;
    }
    dom.playerGold.textContent = gold;

    // Cập nhật thông số Hero
    dom.heroName.textContent = hero.name;
    dom.heroLevel.textContent = `Lv.${hero.level}`;
    dom.heroHpText.textContent = `${hero.hp} / ${hero.maxHp}`;
    dom.heroHpBar.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    dom.heroMpText.textContent = `${hero.mp} / ${hero.maxMp}`;
    dom.heroMpBar.style.width = `${(hero.mp / hero.maxMp) * 100}%`;
    dom.heroShield.textContent = hero.shield;
    dom.heroAtk.textContent = hero.atk;

    // Cập nhật thông số Boss
    dom.bossName.textContent = boss.name;
    if (dom.bossAvatar) dom.bossAvatar.textContent = boss.avatar;
    dom.bossIntent.textContent = `Sắp đánh: ${boss.atk} ST`;
    dom.bossHpText.textContent = `${boss.hp} / ${boss.maxHp}`;
    dom.bossHpBar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    dom.bossShield.textContent = boss.shield;
    dom.bossReward.textContent = `+${boss.rewardGold} Vàng`;

    // Cập nhật trạng thái Lượt đấu
    const turnLabels = {
        PLAYER: "LƯỢT CỦA BẠN",
        BOSS: "QUÁI VẬT ĐANG ĐÁNH...",
        VICTORY: "QUA ẢI!",
        DEFEAT: "THẤT BẠI!"
    };
    dom.turnStatus.textContent = turnLabels[turn] || "LƯỢT CỦA BẠN";
    dom.turnTimer.textContent = `${timeLeft}s`;

    // Vô hiệu hóa nút kỹ năng khi không phải lượt người chơi
    const skillButtons = dom.skillDeck.querySelectorAll(".skill-card");
    skillButtons.forEach(btn => {
        btn.disabled = turn !== "PLAYER";
        btn.style.opacity = turn === "PLAYER" ? "1" : "0.5";
    });
    dom.btnEndTurn.disabled = turn !== "PLAYER";

    // Cập nhật Túi đồ (Inventory)
    dom.inventoryList.innerHTML = inventory
        .map(item => {
            if (item.qty <= 0) {
                return `<div class="inv-slot empty-slot">Đã hết ${item.name.split(" ")[1]}</div>`;
            }
            return `
        <button class="inv-slot" data-item-id="${item.id}" type="button" style="cursor:pointer; color:inherit; text-align:left;">
          ${item.name} <strong>(x${item.qty})</strong>
        </button>
      `;
        })
        .join("");
}

// 12. EVENT DELEGATION: Lắng nghe sự kiện tập trung
dom.skillDeck.addEventListener("click", event => {
    const card = event.target.closest("[data-skill-id]");
    if (!card) return;
    handleSkillUse(card.dataset.skillId);
});

dom.inventoryList.addEventListener("click", event => {
    const slot = event.target.closest("[data-item-id]");
    if (!slot) return;
    handleUseItem(slot.dataset.itemId);
});

dom.btnEndTurn.addEventListener("click", handleEndTurn);
dom.btnShop.addEventListener("click", handleQuickShop);

// Khởi chạy trò chơi khi DOM đã sẵn sàng
document.addEventListener("DOMContentLoaded", initGame);
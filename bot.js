const mineflayer = require('mineflayer')

// ► Lista kont do uruchomienia
const ACCOUNTS = [
  'GorocaPiper133'
]

const BASE_CONFIG = {
  host: 'anarchia.gg',
  port: 25565,
  version: '1.20.1'
}

// ► Główna funkcja bota
function createBotController(username) {
  const BOT_CONFIG = { ...BASE_CONFIG, username }
  let bot
  let clickingRight = false
  let clickInterval = null
  let verificationTimeout = null
  let guiHandled = false
  let payInterval = null
  let moveInterval = null
  let lookInterval = null
  let jumpInterval = null
  let guiTimeout = null
  let restartTimeout = null
  let isRestarting = false

  const log = (msg) => console.log(`[${username}] ${msg}`) // tylko krytyczne logi

  function resetState() {
    clickingRight = false
    guiHandled = false
    isRestarting = false

    if (clickInterval) { clearInterval(clickInterval); clickInterval = null }
    if (guiTimeout) { clearTimeout(guiTimeout); guiTimeout = null }
    if (payInterval) { clearInterval(payInterval); payInterval = null }
    if (verificationTimeout) { clearTimeout(verificationTimeout); verificationTimeout = null }
    if (restartTimeout) { clearTimeout(restartTimeout); restartTimeout = null }

    if (moveInterval) { clearInterval(moveInterval); moveInterval = null }
    if (lookInterval) { clearInterval(lookInterval); lookInterval = null }
    if (jumpInterval) { clearInterval(jumpInterval); jumpInterval = null }
  }

  function stopAllActions() {
    if (clickingRight) {
      clearInterval(clickInterval)
      try { bot.deactivateItem() } catch (e) {}
      clickingRight = false
    }

    try { bot.clearControlStates() } catch (e) {}

    if (verificationTimeout) {
      clearTimeout(verificationTimeout)
      verificationTimeout = null
    }
  }

  function scheduleRestart(delay = 300000) { // 5 minut
    if (isRestarting) return
    isRestarting = true

    stopAllActions()
    if (bot) {
      try { bot.quit() } catch (e) {}
    }

    restartTimeout = setTimeout(() => {
      resetState()
      startBot()
    }, delay)
  }

  function setupRandomActions() {
    lookInterval = setInterval(() => {
      try {
        const yaw = ((Math.random()*360)-180) * Math.PI/180
        const pitch = ((Math.random()*40)-20) * Math.PI/180
        bot.look(yaw, pitch, true).catch(()=>{})
      } catch(e){}
    }, 3000 + Math.floor(Math.random()*2000))

    jumpInterval = setInterval(() => {
      try {
        bot.setControlState('jump', true)
        setTimeout(()=>{ try{bot.setControlState('jump', false)}catch(e){} }, 250 + Math.floor(Math.random()*250))
      } catch(e){}
    }, 8000 + Math.floor(Math.random()*7000))

    moveInterval = setInterval(() => {
      try {
        const moves = ['left','right','forward','back', null, null]
        const choice = moves[Math.floor(Math.random()*moves.length)]
        if (choice) {
          bot.setControlState(choice, true)
          const duration = 400 + Math.floor(Math.random()*800)
          setTimeout(()=>{ try{bot.setControlState(choice,false)}catch(e){} }, duration)
        }
      } catch(e){}
    }, 4000 + Math.floor(Math.random()*3000))
  }

  function startBot() {
    resetState()
    bot = mineflayer.createBot(BOT_CONFIG)

    // === ANTI-TIMEOUT FIX (najważniejsze) ===
    bot._client.socket.setTimeout(0) // wyłącza 30-sekundowy limit
    setInterval(() => {
      try {
        bot._client.write('keep_alive', { keepAliveId: Date.now() }) // serwer widzi że żyje
      } catch {}
    }, 5000)

    function sendChat(botInstance, message) {
      if (!botInstance || !message) return
      try { botInstance.chat(message) } catch(e){}
    }

    bot.once('login', () => {
      setTimeout(() => sendChat(bot,'/login Haslo123!'), 3000)
      verificationTimeout = setTimeout(()=>{
        if(!clickingRight) log('[!] Brak weryfikacji – nie klikam')
      },5000)
      setupRandomActions()
    })

    bot.on('message', (message) => {
      const msg = message.toString()

      // blokady IP
      if (msg.includes('Hej! Wykryliśmy podejrzaną aktywność') || 
          msg.includes('Twój adres został chwilowo zablokowany') ||
          msg.includes('podejrzaną aktywność z twojego adresu IP')) {
        log('[🚨] WYKRYTO BLOKADĘ IP - RESTART ZA 5 MINUT')
        scheduleRestart(300000)
      }

      if (msg.includes('Twoje konto zostało zweryfikowane!') && !clickingRight) {
        clearTimeout(verificationTimeout)
        verificationTimeout = null
        clickingRight = true

        clickInterval = setInterval(() => {
          try { bot.activateItem(); setTimeout(()=>{ try{bot.deactivateItem()}catch(e){} },100) } catch(e){}
        },1000)
      }
    })

    bot.on('windowOpen', async () => {
      if(guiHandled) return
      guiHandled = true

      if(clickingRight){ clearInterval(clickInterval); clickingRight=false }

      try {
        await bot.clickWindow(2,0,0)
        log('[✓] Slot 2 OK')
      } catch(err){ log(`[X] Błąd slot 2: ${err.message}`) }
    })

    bot.on('error',(err)=>{
      log(`[X] Error: ${err.message}`)
      if(err.message.includes('Timed out')){
        resetState()
        setTimeout(startBot,10000)
      }
    })

    bot.on('kicked',(reason)=>{
      log(`[X] Kicked: ${reason}`)
      if (typeof reason === 'string' && (
          reason.includes('Hej! Wykryliśmy podejrzaną aktywność') ||
          reason.includes('Twój adres został chwilowo zablokowany') ||
          reason.includes('podejrzaną aktywność z twojego adresu IP')
      )) {
        scheduleRestart(300000)
      }
    })

    bot.on('end',()=>{
      if (!isRestarting) {
        log('[!] Bot rozłączony – reconnect za 10 s')
        resetState()
        setTimeout(startBot, 10000)
      }
    })
  }

  startBot()
}

// ► Uruchamianie kont po kolei co 1 minutę
function startAccountsSequentially(accounts, delay=60000){
  let index=0
  function next(){
    if(index>=accounts.length) return
    const username=accounts[index]
    console.log(`\n[${username}] ▶ Start`)
    createBotController(username)
    index++
    setTimeout(next,delay)
  }
  next()
}

startAccountsSequentially(ACCOUNTS,60000)

const mineflayer = require('mineflayer')

// ► Lista kont do uruchomienia
const ACCOUNTS = [
  'GorocaPiper133']

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
  let guiTimeout = null
  let guiHandled = false
  let payInterval = null
  let moveInterval = null
  let lookInterval = null
  let jumpInterval = null
  let restartTimeout = null
  let isRestarting = false

  const log = (msg) => console.log(`[${username}] ${msg}`)

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
      log('[!] Zatrzymano klikanie prawym')
    }

    try { bot.clearControlStates() } catch (e) {}
    log('[!] Zatrzymano ruch')

    if (verificationTimeout) {
      clearTimeout(verificationTimeout)
      verificationTimeout = null
      log('[!] Anulowano timeout weryfikacji')
    }

    if (guiTimeout) {
      clearTimeout(guiTimeout)
      guiTimeout = null
    }

    if (moveInterval) { clearInterval(moveInterval); moveInterval = null }
    if (lookInterval) { clearInterval(lookInterval); lookInterval = null }
    if (jumpInterval) { clearInterval(jumpInterval); jumpInterval = null }
  }

  function scheduleRestart(delay = 300000) { // 5 minut domyślnie
    if (isRestarting) return
    
    isRestarting = true
    const minutes = delay / 60000
    log(`[🔄] Zaplanowano restart za ${minutes} minut`)
    
    stopAllActions()
    
    if (bot) {
      try {
        bot.quit()
        log('[!] Rozłączono bota przed restartem')
      } catch (e) {}
    }

    restartTimeout = setTimeout(() => {
      log('[🔄] Uruchamiam bota ponownie...')
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

    function sendChat(botInstance, message) {
      if (!botInstance || !message) return
      if (typeof botInstance.chat === 'function') {
        try { botInstance.chat(message); return } catch(e){}
      }
      const command = message.startsWith('/') ? message.slice(1) : message
      try {
        botInstance._client.write('chat_command', {
          command,
          timestamp: BigInt(Date.now()),
          salt: 0n,
          argumentSignatures: [],
          signedPreview: false,
          previousMessages: [],
          lastSeenMessages: { offset: 0, acknowledged: [] }
        })
      } catch (err) {
        console.error(`[${username}] [sendChat] Błąd wysyłania czatu:`, err && err.message ? err.message : err)
      }
    }

    bot.once('login', () => {
      log('[+] Zalogowano – wysyłam /login za 3 s')
      setTimeout(() => {
        sendChat(bot, '/login Haslo123!')
        log('[>] /login')
      }, 3000)

      // natychmiast ruch do przodu po loginie
      setTimeout(() => {
        try { bot.setControlState('forward', true); log('[>] Ruch do przodu') } catch(e){}
      }, 6000)

      setupRandomActions()

      verificationTimeout = setTimeout(()=>{
        if(!clickingRight) log('[!] Brak weryfikacji – nie klikam')
      },5000)
    })

    bot.on('message', (message) => {
      const msg = message.toString()
      log(`[CHAT] ${msg}`)

      if (msg.includes('Hej! Wykryliśmy podejrzaną aktywność') || 
          msg.includes('Twój adres został chwilowo zablokowany') ||
          msg.includes('podejrzaną aktywność z twojego adresu IP')) {
        log('[🚨] WYKRYTO BLOKADĘ IP - RESTART ZA 5 MINUT')
        scheduleRestart(300000)
        return
      }

      if (msg.includes('Twoje konto zostało zweryfikowane!') && !clickingRight) {
        clearTimeout(verificationTimeout)
        verificationTimeout = null
        log('[✓] Zweryfikowano – start klikania prawym')

        clickingRight = true
        clickInterval = setInterval(() => {
          try { bot.activateItem(); setTimeout(()=>{ try{bot.deactivateItem()}catch(e){} },100) } catch(e){}
        },1000)

        guiTimeout = setTimeout(()=>{
          if(clickingRight){
            log('[!] Nie otwarto GUI w 10 sek – zatrzymuję klikanie')
            clearInterval(clickInterval)
            clickingRight=false
          }
        },10000)
      }

      if (msg.includes('Znajdujesz się w strefie ciszy')) {
        log('[X] Strefa ciszy – quit')
        stopAllActions()
        try{ bot.quit() } catch(e){}
      }
    })

    bot.on('windowOpen', async () => {
      if(guiHandled) return
      guiHandled=true

      if(clickingRight){ clearInterval(clickInterval); clickingRight=false; log('[✓] GUI otwarte – zatrzymano klikanie') }

      log('[*] GUI otwarte – klikam slot 2')
      stopAllActions()

      setTimeout(async ()=>{
        try{
          await bot.clickWindow(2,0,0)
          log('[✓] Slot 2 OK')

          setTimeout(()=>{
            sendChat(bot,'/afk')
            log('[>] /afk')

            setTimeout(async ()=>{
              try{
                await bot.clickWindow(11,0,0)
                log('[✓] Slot 11 OK')
                sendChat(bot,'/pay GorocaPiper133 200')
                log('[>] /pay 200')

                payInterval = setInterval(()=>{
                  sendChat(bot,'/pay GorocaPiper133 200')
                  log('[>] Auto-/pay 200')
                },30000)
              } catch(err){ log(`[X] Błąd slot 11: ${err && err.message?err.message:err}`) }
            },2000)
          },10000)
        } catch(err){ log(`[X] Błąd slot 2: ${err && err.message?err.message:err}`) }
      },2000)
    })

    bot.on('error',(err)=>{
      log(`[X] Error: ${err && err.message?err.message:err}`)
      if(err && err.message && err.message.includes('Timed out')){
        log('[!] Timeout – ponawiam po 10 sekundach')
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
        log('[🚨] WYKRYTO BLOKADĘ IP PRZY KICKU - RESTART ZA 5 MINUT')
        scheduleRestart(300000)
      }
    })

    bot.on('end',()=>{
      if (!isRestarting) {
        log('[!] Rozłączono – reconnect za 10 s')
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

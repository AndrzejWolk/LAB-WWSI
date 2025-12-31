
# 1. Aktualizacja systemu
sudo apt update && sudo apt -y upgrade

# 2. Niezbędne narzędzia
sudo apt -y install git curl build-essential python3 sqlite3 jq

# 3. Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs

# 4. Pobranie repo
git clone https://github.com/<twoje-repo>/WWSI_TechnologieInternetowe.git
cd WWSI_TechnologieInternetowe/labs/Lab01

# 5. Instalacja zależności
npm ci   # lub npm install

# 6. Reset bazy (usuwa library.db)
npm run reset:db

# 7. Start serwera
npm run dev
# Aplikacja: http://localhost:3000


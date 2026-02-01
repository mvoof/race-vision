# Race Vision Telemetry Analysis

**Race Vision**  — это профессиональное десктопное приложение инженерного класса для глубокого анализа телеметрии гоночных симуляторов (Le Mans Ultimate, и в перспективе других).

## Product Vision

В отличие от существующих решений, которые либо слишком сложны, либо слишком аркадны, **Race Vision** предлагает строгий, минималистичный интерфейс, где визуальный шум сведен к нулю, а внимание сфокусировано на поиске десятых долей секунды.

### Ключевые ценности
1. **Strict Professionalism:** Дизайн не развлекает, а информирует.
2. **Race vision Focus:** Уникальные алгоритмы анализа прохождения поворотов.
3. **Instant Clarity:** Четкая иерархия данных, ничего лишнего.

## Технологии

- **Frontend**: React 19, TypeScript, SCSS modules, Zustand, Recharts
- **Icons**: lucide-react
- **Backend**: Tauri 2.0, Rust, DuckDB
- **Build**: Vite 7, ESLint, Prettier
- **i18n**: i18next + react-i18next

## Поддерживаемые игры

- Le Mans Ultimate (LMU) - приоритет
- В будущем: ACC, iRacing, rFactor2

## Структура проекта

```
src/
├── types/              # TypeScript типы
├── stores/             # Zustand stores
├── hooks/              # Custom hooks
├── services/           # Business logic (analysis, track, tauri wrappers)
├── components/
│   ├── common/         # UI Primitives (Button, Panel, etc.) - Redesign needed
│   ├── layout/         # AppLayout, Sidebar
│   ├── session/        # Session Dashboard, Lap List
│   ├── track/          # TrackMap (SVG), Trajectory View
│   ├── charts/         # Telemetry Graphs
│   └── analysis/       # Apex Insight, G-G Diagram
├── pages/              # Routing pages
├── styles/             # Global SCSS, Variables (New Palette)
└── locales/            # i18n
src-tauri/
├── commands/           # Tauri commands
├── db/                 # DuckDB logic
├── parsers/            # Telemetry parsers
└── models/             # Rust structs
```

## Основной функционал (По экранам)

### 1. Настройки и Источник (Settings & Source)
- Выбор корневой папки телеметрии.
- Сканирование подпапок.
- Индикация статуса подключения.
- Персистентное хранение настроек (tauri-plugin-store).

### 2. Дашборд Сессий (Session Dashboard)
- Таблица/Сетка сессий с группировкой по Треку/Дате.
- Быстрый поиск и фильтрация (по треку, машине, пилоту).
- Метрики: Лучшее время, кол-во кругов, машина.

### 3. Анализ Круга (Lap Analysis) - Главный экран
- **Lap List:** Список кругов с цветовой кодировкой секторов.
- **Telemetry Charts:** Синхронизированные графики:
    - Speed vs Distance/Time.
    - Throttle/Brake inputs.
    - Steering Angle, RPM, Gear.
- **Track Map:**
    - SVG-based рендеринг.
    - Heatmap скорости на траектории.
    - Автомасштабирование на сектор при зуме графика.
- **Apex Insight:** Панель с метриками поворота (Min Speed, Entry/Exit Speed).

### 4. Траектория (Trajectory View)
- Фокус на геометрии.
- Сравнение линий (Reference vs Current).
- Маркеры точек торможения и апексов.

## Техническая архитектура

### Парсеры и Данные
- **DuckDB:** Используется для быстрого доступа к time-series данным.
- **Abstract Parser Trait:** Позволяет легко добавлять поддержку новых симуляторов (ACC, iRacing).

### Каналы телеметрии и частоты (LMU)

Согласно конфигурации (`samples/config.json`), данные записываются со следующими частотами:

**100 Hz (High Frequency):**
- **Engine/Drive:** `Engine RPM`, `Ground Speed`, `Wheel Speed`, `Turbo Boost Pressure`, `Regen Rate`.
- **Steering:** `Steering Pos` (Raw/Unfiltered), `Steering Shaft Torque`.
- **Suspension:** `Susp Pos`, `RideHeights`, `FrontRideHeight`, `RearRideHeight`, `Front3rdDeflection`, `Rear3rdDeflection`.
- **Tyres (Temp):** `TyresTempCentre`, `TyresTempLeft`, `TyresTempRight` (Surface temperatures).
- **Other:** `FFB Output`, `GPS Time`.

**50 Hz (Inputs & Brakes):**
- **Inputs:** `Throttle Pos`, `Brake Pos`, `Clutch Pos` (Raw/Unfiltered).
- **Brakes:** `Brakes Temp`, `Brakes Force`, `Brakes Air Temp`.
- **Tyres:** `TyresRimTemp`.

**20 Hz (Consumables):**
- `Fuel Level`.
- `SoC` (State of Charge), `Virtual Energy`.

**10 Hz (Physics & GPS):**
- **GPS:** `GPS Latitude`, `GPS Longitude`, `GPS Speed`.
- **G-Forces:** `G Force Lat`, `G Force Long`, `G Force Vert`.
- **Tyres (State):** `TyresPressure`, `Tyres Wear`, `TyresRubberTemp` (Core temp).
- **Track:** `Lap Dist`, `Total Dist`, `Path Lateral`, `Track Edge`.
- **Brakes:** `Brake Thickness`.

**Low Frequency (1-7 Hz):**
- `TyresCarcassTemp` (5 Hz).
- `Engine Oil Temp`, `Engine Water Temp` (7 Hz).
- `OverheatingState`, `Time Behind Next` (2 Hz).
- **Environment:** `Ambient Temperature`, `Track Temperature`, `Wind Speed`, `Wind Heading` (1 Hz).

### Отрисовка Трека
- Координаты: GPS Latitude/Longitude -> Mercator Projection -> SVG.
- Layers: Boundaries (GeoJSON/Offset), Racing Line, Start/Finish lines.
- Interaction: Zoom/Pan, Click to sync timeline.

## План разработки (Roadmap)

### Phase 1: Foundation & Design (Текущий этап)
- [x] **Rebranding:** Переименование проекта и рефакторинг структуры под Race Vision.
- [x] **Design System:** Обновление CSS переменных (Colors, Typography) в SCSS.
- [x] **UI Components:** Создание базовых компонентов в стиле "Race Vision Professional".
- [x] **Layout:** Рефакторинг `AppLayout` и `Sidebar`.

### Phase 2: Data & Dashboard
- [x] **Session Dashboard:** Реализация нового экрана выбора сессий (Refactored to "Dumb" component).
- [x] **Filtering:** Улучшение навигации и поиска сессий (Moved to DashboardStore).
- [x] **Logic Migration:** Перенос тяжелых вычислений (Boundary Gen) в Rust.
- [ ] **Parser Integration:** Адаптация парсера LMU к новому формату данных UI.

### Phase 3: Deep Analysis & Visualization
- [ ] **Charts:** Синхронизация зума графиков и карты трека.
- [ ] **Track Map:** Улучшение алгоритма сглаживания и отрисовки границ.
- [ ] **Comparison:** Overlay сравнение двух кругов (графики + карта).
- [ ] **Apex Insight:** Реализация виджета метрик поворота.

### Phase 4: Advanced Analytics (Future Features)
_Интеграция расширенных функций из оригинального плана_

#### Визуализация и анализ трека
1.  **Corner Analysis:** Автоопределение поворотов, анализ входа/апекса/выхода, min speed points.
2.  **Track Evolution:** Анализ изменения состояния трека (rubber in) и сравнение секторов.
3.  **Sector Heatmap:** Раскраска трека по дельте времени относительно эталона.
4.  **Racing Line Optimization:** Идеальная траектория vs Реальная (deviation analysis).
5.  **Track Limits:** Детекция и визуализация выездов за границы.

#### Виджеты данных (Data Widgets)
6.  **Digital Dashboard (DDU):** Спидометр, RPM, передача, shift lights.
7.  **Tire Monitor:** Температура (I/C/O), давление, износ.
8.  **Brake Monitor:** Температура дисков, brake force, lock-up indicators.
9.  **G-Force & Friction Circle:** G-G диаграмма с trail effect.
10. **Pedal Inputs:** Вертикальные бары с высокой точностью.

#### Сравнение и Стратегия
11. **Ghost Car:** Визуальное сравнение позиций машин на карте ("призрак").
12. **Best Theoretical Lap:** Комбинация лучших секторов сессии.
13. **Consistency Analysis:** Heatmap стабильности прохождения кругов.
14. **Delta Time Graph:** Real-time дельта по дистанции.
15. **Strategy:** Калькулятор топлива и износа шин.

#### Экспорт и Отчеты
16. **Session Report:** Генерация PDF/HTML отчета.
17. **Video Overlay:** Экспорт PNG последовательности для наложения на видео.
18. **Data Export:** CSV/JSON и формат MoTeC i2 (если возможно).

## Команды

```bash
# Разработка
npm run dev              # Vite dev server
npm run tauri dev        # Запуск приложения

# Сборка
npm run tauri:build:release
```

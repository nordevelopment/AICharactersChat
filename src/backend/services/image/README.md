# Image Service Architecture

Новая архитектура для работы с image генерацией через множественные провайдеры.

## Структура

```
src/backend/services/image/
├── interfaces/
│   ├── types.ts                 # Общие типы
│   └── image-provider.interface.ts  # Интерфейс провайдера
├── providers/
│   ├── base.provider.ts         # Базовый класс с общей логикой
│   ├── xai.provider.ts          # X.AI Grok Imagine провайдер
│   └── together.provider.ts     # Together AI провайдер
├── factory/
│   └── image-provider.factory.ts # Фабрика провайдеров
├── image.service.ts             # Основной сервис
├── index.ts                     # Экспорты
└── README.md                    # Документация
```

## Использование

### Базовое использование

```typescript
import { ImageService } from './services/image';

const imageService = new ImageService();

// Генерация с провайдером по умолчанию (xai)
const result = await imageService.generate('beautiful sunset');

// Генерация с конкретным провайдером
const result2 = await imageService.generate('beautiful sunset', {}, 'together');

// Редактирование изображения
const editResult = await imageService.editImage(
    'make it night time',
    { reference_images: ['https://example.com/image.jpg'] },
    'xai'
);
```

### Продвинутое использование

```typescript
import { ImageProviderFactory } from './services/image';

// Получить конкретный провайдер
const xaiProvider = ImageProviderFactory.getProvider('xai');
const togetherProvider = ImageProviderFactory.getProvider('together');

// Установить провайдер по умолчанию
imageService.setDefaultProvider('together');

// Получить список доступных провайдеров
const providers = imageService.getAvailableProviders(); // ['xai', 'together']
```

## Добавление нового провайдера

1. Создать новый класс в `providers/` наследуя `BaseImageProvider`
2. Реализовать абстрактные методы:
   - `buildGeneratePayload()`
   - `buildEditPayload()`
3. Добавить в `ImageProviderFactory.createProvider()`
4. Обновить тип `ImageProviderType`

## Преимущества архитектуры

- **Простота**: Единый интерфейс для всех провайдеров
- **Расширяемость**: Легко добавлять новые провайдеры
- **Переиспользование**: Общая логика в базовом классе
- **Flexibility**: Можно переключаться между провайдерами
- **Singleton**: Фабрика кэширует экземпляры провайдеров
- **Type Safety**: Полная типизация TypeScript

## Конфигурация

В `.env` файле:
```
IMAGE_DEFAULT_PROVIDER=xai
XAI_API_KEY=your_xai_key
TOGETHER_API_KEY=your_together_key
```

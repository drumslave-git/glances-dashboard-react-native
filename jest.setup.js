// Tamagui needs an explicit build target when it runs outside Metro.
process.env.TAMAGUI_TARGET = process.env.TAMAGUI_TARGET ?? 'native';

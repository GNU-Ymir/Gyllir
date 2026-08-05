CMAKE_MINIMUM_REQUIRED(VERSION 3.20)
PROJECT(Midgard C)

#set(CMAKE_YMIR_COMPILER "/home/emile/ymir/gcc/gcc-install/bin/gyc")
set(CMAKE_YMIR_COMPILER "gyc")
set(CMAKE_YMIR_RELEASE_FLAGS "-fPIC" "-O3" "-fv")
set(CMAKE_YMIR_DEBUG_FLAGS "${CMAKE_YMIR_RELEASE_FLAGS}" "-fversion=DEBUG_LIB" "-g")
set(CMAKE_YMIR_UNITTEST_FLAGS "${CMAKE_YMIR_DEBUG_FLAGS}" "-funittest")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -g")

FILE (
  GLOB_RECURSE
  SRC
  src/main.yr
  )


FILE (
  GLOB_RECURSE
  TESTS
  tests/__lib__.yr
  )

FILE (
  GLOB_RECURSE
  RES_HTML
  res/html/*
  )

FILE (
  GLOB_RECURSE
  RES_JS
  res/js/*
  )

FILE (
  GLOB_RECURSE
  RES_ICO
  res/ico/*
  )

FILE (
  GLOB_RECURSE
  RES_CSS
  res/css/*
)


set_source_files_properties (
  ${CMAKE_CURRENT_BINARY_DIR}gyllir_lib.o
  PROPERTIES GENERATED TRUE
)


SET_SOURCE_FILES_PROPERTIES(${SRC} PROPERTIES LANGUAGE C)
add_custom_target (gyllir ALL
  COMMENT "Building gyllir"
  COMMAND ${CMAKE_YMIR_COMPILER} ${CMAKE_YMIR_DEBUG_FLAGS} ${CMAKE_CURRENT_SOURCE_DIR}/src/main.yr -o ${CMAKE_CURRENT_BINARY_DIR}/gyllir
)

add_custom_target(gyllir_lib ALL
  COMMENT "Building gyllir_lib"
  COMMAND ${CMAKE_YMIR_COMPILER} ${CMAKE_YMIR_UNITTEST_FLAGS} ${CMAKE_CURRENT_SOURCE_DIR}/src/gyllir.yr -c -o ${CMAKE_CURRENT_BINARY_DIR}/gyllir_lib.o
)

add_custom_target (gyllir_tests ALL
  COMMENT "Building gyllir_tests"
  COMMAND ${CMAKE_YMIR_COMPILER} ${CMAKE_YMIR_UNITTEST_FLAGS} ${CMAKE_CURRENT_SOURCE_DIR}/test/gyllir_test.yr -I ${CMAKE_CURRENT_SOURCE_DIR}/src/gyllir.yr -o ${CMAKE_CURRENT_BINARY_DIR}/gyllir_tests ${CMAKE_CURRENT_BINARY_DIR}/gyllir_lib.o
)

add_dependencies(gyllir_tests gyllir_lib)

install (FILES ${CMAKE_CURRENT_BINARY_DIR}/gyllir DESTINATION /usr/bin/)
install (FILES ${RES_HTML} DESTINATION /etc/gyllir/res/html/)
install (FILES ${RES_JS} DESTINATION /etc/gyllir/res/js/)
install (FILES ${RES_CSS} DESTINATION /etc/gyllir/res/css/)
install (FILES ${RES_ICO} DESTINATION /etc/gyllir/res/ico/)

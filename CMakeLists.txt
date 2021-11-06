CMAKE_MINIMUM_REQUIRED(VERSION 2.6)
PROJECT(Midgard C)
SET(CMAKE_C_COMPILER "gyc")
set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -O3")

FILE (
  GLOB_RECURSE
  SRC
  src/*.yr
  )

SET_SOURCE_FILES_PROPERTIES(${SRC} PROPERTIES LANGUAGE C)
add_executable (gyllir ${SRC})
include_directories(${CMAKE_SOURCE_DIR}/src/)
install (TARGETS gyllir DESTINATION $ENV{HOME}/.local/bin/)












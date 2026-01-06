package com.xiaohongshu.sns.demo.common.utils;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.type.CollectionType;
import com.fasterxml.jackson.databind.type.MapType;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
public final class JsonHelper {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final ObjectMapper SNAKE_CASE_OBJECT_MAPPER = new ObjectMapper();

    static {
        OBJECT_MAPPER.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        OBJECT_MAPPER.enable(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT);
        OBJECT_MAPPER.disable(DeserializationFeature.FAIL_ON_IGNORED_PROPERTIES);
        OBJECT_MAPPER.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        SNAKE_CASE_OBJECT_MAPPER.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        SNAKE_CASE_OBJECT_MAPPER.setPropertyNamingStrategy(new PropertyNamingStrategies.SnakeCaseStrategy());
        SNAKE_CASE_OBJECT_MAPPER.enable(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT);
        SNAKE_CASE_OBJECT_MAPPER.disable(DeserializationFeature.FAIL_ON_IGNORED_PROPERTIES);
        SNAKE_CASE_OBJECT_MAPPER.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }


    /**
     * 将对象转换为 JSON 字符串
     *
     * @param object
     * @param snakeCase
     * @param <T>
     * @return
     */
    public static <T> String toJson(T object, boolean snakeCase) {
        try {
            ObjectMapper mapper = snakeCase ? SNAKE_CASE_OBJECT_MAPPER : OBJECT_MAPPER;
            return mapper.writeValueAsString(object);
        } catch (Exception e) {
            log.error("Error converting object to JSON: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 将 JSON 字符串转换为对象
     *
     * @param json
     * @param clazz
     * @param snakeCase
     * @param <T>
     * @return
     */
    public static <T> T fromJson(String json, Class<T> clazz, boolean snakeCase) {
        try {
            ObjectMapper mapper = snakeCase ? SNAKE_CASE_OBJECT_MAPPER : OBJECT_MAPPER;
            return mapper.readValue(json, clazz);
        } catch (Exception e) {
            log.error("Error converting JSON to object: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 将 JSON 字符串转换为 List
     *
     * @param json
     * @param clazz
     * @param <T>
     * @return
     */
    public static <T> List<T> fromJsonToList(String json, Class<T> clazz, boolean snakeCase) {
        try {
            ObjectMapper mapper = snakeCase ? SNAKE_CASE_OBJECT_MAPPER : OBJECT_MAPPER;
            CollectionType type = mapper.getTypeFactory().constructCollectionType(List.class, clazz);
            return mapper.readValue(json, type);
        } catch (Exception e) {
            log.error("Error converting JSON to List: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 将 JSON 字符串转换为 List
     *
     * @param json
     * @param clazz
     * @param <T>
     * @return
     */
    public static <T> Set<T> fromJsonToSet(String json, Class<T> clazz, boolean snakeCase) {
        try {
            ObjectMapper mapper = snakeCase ? SNAKE_CASE_OBJECT_MAPPER : OBJECT_MAPPER;
            CollectionType type = mapper.getTypeFactory().constructCollectionType(Set.class, clazz);
            return mapper.readValue(json, type);
        } catch (Exception e) {
            log.error("Error converting JSON to Set: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * 将 JSON 字符串转换为 Map
     *
     * @param json
     * @param keyClass
     * @param valueClass
     * @param <K>
     * @param <V>
     * @return
     */
    public static <K, V> Map<K, V> fromJsonToMap(String json, Class<K> keyClass, Class<V> valueClass, boolean snakeCase) {
        try {
            ObjectMapper mapper = snakeCase ? SNAKE_CASE_OBJECT_MAPPER : OBJECT_MAPPER;
            MapType type = mapper.getTypeFactory().constructMapType(Map.class, keyClass, valueClass);
            return mapper.readValue(json, type);
        } catch (Exception e) {
            log.error("Error converting JSON to Map: {}", e.getMessage(), e);
            return null;
        }
    }
}
